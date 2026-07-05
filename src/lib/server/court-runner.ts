/**
 * flowEdge — 投资法庭核心编排器（Court Runner）
 *
 * 一次 Court Session 的完整流程（两阶段架构，参考PA_Agent）：
 *   阶段一：闸门诊断（Gate Diagnosis）
 *     1) 加载市场数据（K线 + 技术指标）
 *     2) 闸门诊断：数据充足?→市场可识别?→高潮风险?→风控熔断?（任何一步no则短路）
 *     3) 场景分类 + 策略路由（breakout/pullback/oversold等）
 *   阶段二：5大师辩论 + 裁决
 *     4) 加载组合状态
 *     5) 5 位投资大师依次分析（带上场景策略上下文）
 *     6) 风控评估（ATR/波动率/仓位上限）
 *     7) 加权聚合 → 初步裁决
 *     8) 交易者方程硬检查（R:R≥1.5 + 正期望）
 *     9) 执行模拟盘订单（如需）
 *    10) 持久化案件 + 溯源
 */

import { randomBytes } from "node:crypto";
import { createDoubaoService } from "@/lib/server/ai-service";
import { MarketDataSource } from "@/lib/server/data-source";
import {
  assessRisk,
  calculateRiskLevels,
  computeAllowedActions,
  SINGLE_STOCK_STOP_LOSS_PCT,
} from "@/lib/server/risk-engine";
import { runGateDiagnosis } from "@/lib/server/gate-engine";
import { classifyScenario } from "@/lib/server/scenario-router";
import { checkTraderEquation } from "@/lib/server/trader-equation";
import { createPortfolio, executeOrder } from "@/lib/server/portfolio-manager";
import { runReplay } from "@/lib/server/replay-engine";
import { getScenarioWeights, getWeightSync } from "@/lib/server/weight-store";
import {
  getCase,
  loadPortfolio,
  primeStore,
  saveCase,
  savePortfolio,
  saveTraces,
} from "@/lib/server/case-store";
import { hashJson } from "@/lib/server/xapi-trace";
import type {
  AnalystSignal,
  CourtContext,
  MasterId,
  Portfolio,
  PortfolioDecision,
  RiskAssessment,
  ScenarioType,
  TradeAction,
  TradeCase,
  TraceRecord,
  Verdict,
} from "@/lib/types";

// 5 位核心投资大师（顺序就是发言顺序）
const MASTERS: Array<{
  id: MasterId;
  name: string;
  importFn: () => Promise<{ default?: (input: never) => Promise<AnalystSignal> }>;
}> = [
  { id: "buffett", name: "沃伦·巴菲特", importFn: () => import("./agents/buffett") },
  { id: "soros", name: "乔治·索罗斯", importFn: () => import("./agents/soros") },
  { id: "dalio", name: "瑞·达利欧", importFn: () => import("./agents/dalio") },
  { id: "lynch", name: "彼得·林奇", importFn: () => import("./agents/lynch") },
  { id: "livermore", name: "杰西·利弗莫尔", importFn: () => import("./agents/livermore") },
];

// ---------------------------------------------------------------------------
// Event types
// ---------------------------------------------------------------------------

export type CourtEvent =
  | { type: "case_started"; caseId: string; symbol: string; timestamp: string }
  | { type: "progress"; step: string; percent: number; message: string }
  | {
      type: "data_loaded";
      bars: number;
      scenario: ScenarioType;
      price: number;
      indicators: Record<string, number>;
      klines?: Array<{ t: string; o: number; h: number; l: number; c: number; v: number }>;
      quote?: { price: number; change: number; changePercent: number; high: number; low: number; volume: number };
      technicals?: Record<string, number | undefined>;
    }
  | { type: "circuit_breaker"; triggered: boolean; reason?: string }
  | { type: "agent_started"; masterId: MasterId; masterName: string }
  | { type: "agent_signal"; masterId: MasterId; signal: AnalystSignal; latencyMs: number }
  | { type: "risk_assessed"; assessment: RiskAssessment }
  | { type: "decision_made"; decision: PortfolioDecision; allowed: { maxShares: number } }
  | { type: "order_executed"; action: string; quantity: number; price: number }
  | { type: "case_completed"; caseId: string; verdict: string; position?: string }
  | { type: "error"; message: string; recoverable: boolean };

export type CourtEventCallback = (event: CourtEvent) => void | Promise<void>;

export interface RunCourtSessionParams {
  context: CourtContext;
  onEvent?: CourtEventCallback;
  aiService?: ReturnType<typeof createDoubaoService>;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function createTraceId() {
  return `fe-${Date.now().toString(36)}-${randomBytes(3).toString("hex")}`;
}

function makeFallbackSignal(masterName: string, reason: string): AnalystSignal {
  return {
    direction: "neutral",
    confidence: 0.5,
    thesis: `[fallback] ${masterName}：${reason}`,
    keyPoints: ["AI 调用失败", "使用中性兜底信号", "不构成操作建议"],
    timeHorizon: "短期",
  };
}

function round2(n: number): number { return Math.round(n * 100) / 100; }

async function emit(onEvent: CourtEventCallback | undefined, event: CourtEvent): Promise<void> {
  if (!onEvent) return;
  try {
    await onEvent(event);
  } catch {
    // swallow — event emission must never crash the session
  }
}

// ---------------------------------------------------------------------------
// runCourtSession
// ---------------------------------------------------------------------------

export async function runCourtSession(params: RunCourtSessionParams): Promise<TradeCase> {
  const { context, onEvent, aiService } = params;
  const service = aiService ?? createDoubaoService();

  // 确保 case-store 已从磁盘预热
  await primeStore().catch(() => undefined);

  const caseId = `case-${Date.now().toString(36)}`;
  const startedAt = new Date().toISOString();
  const traces: TraceRecord[] = [];
  const signalMap = {} as Record<
    MasterId,
    { signal: "bullish" | "bearish" | "neutral"; confidence: number; weightPercent?: number } | null
  >;
  const analystSignals = {} as Record<MasterId, AnalystSignal>;

  // 初始化所有 master 槽位为 null
  for (const m of MASTERS) signalMap[m.id] = null;

  // ---- 1) case_started ----
  await emit(onEvent, {
    type: "case_started",
    caseId,
    symbol: context.symbol,
    timestamp: startedAt,
  });

  const progress = async (percent: number, message: string) => {
    await emit(onEvent, {
      type: "progress",
      step: message,
      percent: Math.round(percent),
      message,
    });
  };

  try {
    // ---- 2) 加载市场数据 ----
    await progress(5, "正在加载市场数据...");
    const marketData = await MarketDataSource.getMarketData(context.symbol);
    let { bars, technicals, scenario } = marketData;
    let { quote } = marketData;

    // ---- 时间机器模式：切片到决策日期 ----
    let futureBars: typeof bars = [];
    let isTimeMachine = false;
    if (context.decisionDate) {
      isTimeMachine = true;
      const cutoff = new Date(context.decisionDate);
      cutoff.setHours(23, 59, 59, 999);
      const cutoffMs = cutoff.getTime();
      const splitIdx = bars.findIndex(b => new Date(b.timestamp).getTime() > cutoffMs);
      if (splitIdx > 0 && splitIdx < bars.length) {
        futureBars = bars.slice(splitIdx, splitIdx + 10); // 最多取10根给回放
        bars = bars.slice(0, splitIdx);
      } else if (splitIdx === -1) {
        // 所有K线都在决策日之前，没有未来数据
        futureBars = [];
      }
      // 重新基于切片后的bars计算 quote（不能用实时报价）
      if (bars.length >= 2) {
        const lastBar = bars[bars.length - 1];
        const prevBar = bars[bars.length - 2];
        const chg = lastBar.close - prevBar.close;
        quote = {
          price: lastBar.close,
          change: round2(chg),
          changePercent: round2((chg / prevBar.close) * 100),
          high: lastBar.high,
          low: lastBar.low,
          volume: lastBar.volume,
        };
        // 重新计算technicals（基于切片后的bars）
        technicals = MarketDataSource.computeTechnicals(bars);
        scenario = MarketDataSource.classifyScenario(technicals);
      }
    }
    const currentPrice = quote.price;

    const indicators: Record<string, number> = {
      price: currentPrice,
      rsi: Number(technicals.rsi?.toFixed(2) ?? 50),
      volumeRatio: Number(technicals.volumeRatio?.toFixed(2) ?? 1),
      atr: Number(technicals.atr?.toFixed(2) ?? 0),
      ma20: Number(technicals.ma20?.toFixed(2) ?? currentPrice),
      changePct: Number(quote.change ? ((quote.change / (currentPrice - quote.change)) * 100).toFixed(2) : 0),
      annualizedVolatility: Number(
        (technicals.annualizedVolatility ?? 0.25).toFixed(4),
      ),
    };

    await emit(onEvent, {
      type: "data_loaded",
      bars: bars.length,
      scenario,
      price: currentPrice,
      indicators,
      klines: bars.map(b => ({
        t: b.timestamp,
        o: b.open,
        h: b.high,
        l: b.low,
        c: b.close,
        v: b.volume,
        ma5: b.ma5 ?? null,
        ma20: b.ma20 ?? null,
        ma60: b.ma60 ?? null,
      })),
      quote: {
        price: quote.price,
        change: quote.change,
        changePercent: Number(quote.change ? ((quote.change / (currentPrice - quote.change)) * 100).toFixed(2) : 0),
        high: quote.high,
        low: quote.low,
        volume: quote.volume,
      },
      technicals: {
        rsi: technicals.rsi,
        ema8: technicals.ema8,
        ema21: technicals.ema21,
        ema55: technicals.ema55,
        macd: technicals.macd,
        bollingerUpper: technicals.bollingerUpper,
        bollingerLower: technicals.bollingerLower,
        atr: technicals.atr,
        adx14: technicals.adx14,
        volumeRatio: technicals.volumeRatio,
        volatility20d: technicals.volatility20d,
      },
    });

    // ---- 3) 闸门诊断（阶段一） ----
    await progress(10, "闸门诊断中...");
    const portfolio0 = loadPortfolio() ?? createPortfolio();
    // 计算组合汇总
    const posValue = portfolio0.positions.reduce((s, p) => s + p.quantity * p.currentPrice, 0);
    const totalVal = portfolio0.cash + posValue;
    const dailyPnl = portfolio0.realizedPnl; // 近似
    const maxDd = Math.max(0, (portfolio0.initialBalance - totalVal) / portfolio0.initialBalance);
    const gateInput = {
      bars: marketData.bars,
      technicals,
      portfolio: {
        cash: portfolio0.cash,
        totalValue: totalVal,
        positions: portfolio0.positions.map(p => ({
          symbol: p.symbol,
          quantity: p.quantity,
          avgCost: p.entryPrice,
          currentPrice: p.currentPrice,
        })),
        dailyPnl,
        maxDrawdown: maxDd,
      },
      currentPrice,
    };
    const gateDiagnosis = runGateDiagnosis(gateInput);

    await emit(onEvent, {
      type: "gate_result",
      verdict: gateDiagnosis.verdict,
      nodes: gateDiagnosis.nodes,
      marketRegime: gateDiagnosis.marketRegime,
      direction: gateDiagnosis.direction,
      climaxRisk: gateDiagnosis.climaxRisk,
    } as any);

    if (gateDiagnosis.verdict !== "proceed") {
      await progress(18, `闸门驳回：${gateDiagnosis.gateRejectReason ?? "市场条件不满足"}`);
      const rejectedCase: TradeCase = {
        caseId,
        symbol: context.symbol,
        scenario,
        openedAt: startedAt,
        closedAt: new Date().toISOString(),
        entryPrice: currentPrice,
        direction: "flat",
        signals: signalMap,
        outcome: "breakeven",
      };
      saveCase(rejectedCase);
      await emit(onEvent, {
        type: "case_completed",
        caseId,
        verdict: "REJECT",
        position: `闸门驳回：${gateDiagnosis.gateRejectReason ?? "Gate 拒绝"}`,
      });
      return rejectedCase;
    }

    // ---- 3.5) 场景分类 + 策略路由 ----
    await progress(18, "场景分类...");
    const scenarioResult = classifyScenario({
      gateDiagnosis: {
        marketRegime: gateDiagnosis.marketRegime,
        direction: gateDiagnosis.direction,
        climaxRisk: gateDiagnosis.climaxRisk,
      },
      technicals,
      currentPrice,
      bars: marketData.bars,
      userIdea: context.userIdea,
    });
    // 用分类后的scenario覆盖默认值
    const routedScenario = scenarioResult.scenario as unknown as ScenarioType;
    await emit(onEvent, {
      type: "scenario_classified",
      scenario: scenarioResult.scenario,
      scenarioName: scenarioResult.scenarioName,
      confidence: scenarioResult.confidence,
      description: scenarioResult.description,
      strategyContext: scenarioResult.strategyContext,
    } as any);

    // ---- 4) 加载组合 ----
    await progress(20, "加载投资组合状态...");
    let portfolio: Portfolio = portfolio0;

    // ---- 4.5) 加载场景权重（使用分类后的场景），给每个大师分配权重占比 ----
    let scenarioWeights: Record<string, number>;
    try {
      scenarioWeights = await getScenarioWeights(routedScenario);
    } catch {
      scenarioWeights = {};
      for (const m of MASTERS) scenarioWeights[m.id] = getWeightSync(m.id, routedScenario) ?? 1.0;
    }
    const totalW = MASTERS.reduce((s, m) => s + (scenarioWeights[m.id] ?? 1.0), 0);

    // ---- 5) 调用 5 位大师（并行）----
    await progress(25, "大师们同时开始分析...");
    // 先统一发送 agent_started
    for (const master of MASTERS) {
      await emit(onEvent, { type: "agent_started", masterId: master.id, masterName: master.name });
    }
    await progress(30, "5位大师并行分析中...");

    const analystPromises = MASTERS.map(async (master) => {
      const callStart = Date.now();
      let signal: AnalystSignal;
      let traceStatus: TraceRecord["status"] = "success";
      let traceError: string | undefined;
      try {
        const mod = await master.importFn();
        const fn = (mod.default ??
          (mod as Record<string, unknown>)[`analyze${capitalize(master.id)}`]) as
          | ((input: never) => Promise<AnalystSignal>)
          | undefined;
        if (typeof fn !== "function") throw new Error(`agent ${master.id} 未导出默认分析函数`);
        signal = await fn({
          symbol: context.symbol, currentPrice, technicals,
          fundamentals: undefined, sentiment: undefined,
          userIdea: context.userIdea, scenario, aiService: service,
        } as never);
      } catch (err) {
        signal = makeFallbackSignal(master.name, err instanceof Error ? err.message : String(err));
        traceStatus = "fallback";
        traceError = err instanceof Error ? err.message : String(err);
      }
      const latencyMs = Math.max(0, Date.now() - callStart);
      const w = scenarioWeights[master.id] ?? 1.0;
      signal.weightPercent = Math.round((w / totalW) * 100);
      const trace: TraceRecord = {
        id: createTraceId(), caseId, source: master.id, action: `analyze.${master.id}`,
        inputHash: hashJson({ symbol: context.symbol, currentPrice, technicals: indicators, scenario, userIdea: context.userIdea ?? "" }),
        outputHash: hashJson(signal), startedAt: new Date(callStart).toISOString(), endedAt: new Date().toISOString(),
        latencyMs, status: traceStatus, error: traceError, provider: "doubao", outputPreview: signal.thesis.slice(0, 120),
      };
      return { master, signal, latencyMs, trace };
    });

    // 等待所有大师完成
    const results = await Promise.all(analystPromises);
    // 按完成时间排序（先完成的先发event）
    results.sort((a, b) => a.latencyMs - b.latencyMs);
    for (let i = 0; i < results.length; i++) {
      const { master, signal, latencyMs, trace } = results[i];
      analystSignals[master.id] = signal;
      signalMap[master.id] = { signal: signal.direction, confidence: signal.confidence, weightPercent: signal.weightPercent };
      traces.push(trace);
      await emit(onEvent, { type: "agent_signal", masterId: master.id, signal, latencyMs });
      const pct = 30 + Math.round(((i + 1) / results.length) * 55);
      await progress(pct, `${master.name} 分析完成（${latencyMs}ms）`);
    }

    // ---- 6) 风控评估 ----
    await progress(85, "风控评估中...");
    const annualizedVol = technicals.annualizedVolatility ?? 0.25;
    const dailyVol =
      technicals.dailyVolatility ??
      (technicals.atr && currentPrice > 0 ? technicals.atr / currentPrice : 0.02);

    const assessment = assessRisk({
      portfolio,
      currentPrice,
      annualizedVolatility: annualizedVol,
      dailyVolatility: dailyVol,
      symbol: context.symbol,
    });
    // 补充技术指标
    assessment.rsi = technicals.rsi;
    assessment.volumeRatio = technicals.volumeRatio;
    assessment.atr = technicals.atr;
    assessment.atrPct = technicals.atr && currentPrice > 0 ? technicals.atr / currentPrice : undefined;

    await emit(onEvent, { type: "risk_assessed", assessment });

    // ---- 7) 投资组合经理最终裁决 ----
    await progress(90, "投资组合经理做最终裁决...");
    // 使用前面加载好的 scenarioWeights（不再重复拉取）
    const weights = scenarioWeights;

    // 加权聚合
    let weightedSum = 0;
    let totalWeight = 0;
    for (const m of MASTERS) {
      const sig = signalMap[m.id];
      if (!sig) continue;
      const w = weights[m.id] ?? 1.0;
      const dir = sig.signal === "bullish" ? 1 : sig.signal === "bearish" ? -1 : 0;
      weightedSum += dir * sig.confidence * w;
      totalWeight += w;
    }
    const weightedScore = totalWeight > 0 ? weightedSum / totalWeight : 0;

    let action: TradeAction = "hold";
    let verdict: Verdict = "REJECT";
    if (assessment.circuitBreakerActive) {
      action = "hold";
      verdict = "REJECT";
    } else if (weightedScore > 0.3) {
      action = "buy";
      verdict = "BUY";
    } else if (weightedScore < -0.3) {
      action = "sell";
      verdict = "SELL";
    } else {
      action = "hold";
      verdict = "REJECT";
    }

    const allowed = computeAllowedActions({
      riskAssessment: assessment,
      portfolio,
      currentPrice,
      symbol: context.symbol,
    });

    // 计算数量
    let quantity = 0;
    let stopLoss: number | undefined;
    let takeProfit: number | undefined;
    if (action === "buy" && allowed.canBuy) {
      // 用 recommendedSizePct 决定仓位大小，取整到 100 股
      const targetNotional = assessment.portfolioValue * allowed.recommendedSizePct * 0.5; // 保守半仓
      quantity = Math.floor(targetNotional / currentPrice / 100) * 100;
      quantity = Math.min(quantity, allowed.maxBuyShares);
      if (quantity > 0) {
        const atr = technicals.atr ?? currentPrice * 0.03;
        const levels = calculateRiskLevels({
          entryPrice: currentPrice,
          atr,
          direction: "long",
        });
        stopLoss = levels.stopLoss;
        takeProfit = levels.takeProfit;
      } else {
        action = "hold";
        verdict = "REJECT";
      }
    } else if (action === "sell" && allowed.canSell) {
      const existing = portfolio.positions.find((p) => p.symbol === context.symbol);
      quantity = existing?.quantity ?? 0;
      if (quantity <= 0) {
        action = "hold";
        verdict = "REJECT";
      }
    }

    // ---- 7.5) 交易者方程硬检查 ----
    let traderEqPassed = true;
    let traderEqReason = "";
    let traderEqSuggestion = "";
    if ((action === "buy" || action === "sell") && stopLoss && takeProfit && quantity > 0) {
      const eqResult = checkTraderEquation({
        direction: action === "buy" ? "long" : "short",
        entryPrice: currentPrice,
        stopLoss,
        takeProfit,
        scenarioConfidence: scenarioResult.confidence,
        adx14: technicals.adx14,
      });
      traderEqPassed = eqResult.passed;
      traderEqReason = eqResult.reason;
      traderEqSuggestion = eqResult.suggestion ?? "";
      await emit(onEvent, {
        type: "trader_equation",
        passed: eqResult.passed,
        reason: eqResult.reason,
        riskRewardRatio: eqResult.riskRewardRatio,
        estimatedWinRate: eqResult.estimatedWinRate,
        expectedValue: eqResult.expectedValue,
        suggestion: eqResult.suggestion,
      } as any);

      if (!eqResult.passed) {
        // 交易者方程不通过，强制不下单
        action = "hold";
        verdict = "REJECT";
        quantity = 0;
        stopLoss = undefined;
        takeProfit = undefined;
        await progress(93, `交易者方程未通过：${eqResult.reason}`);
      }
    }

    const reasoning = buildReasoning({
      weightedScore,
      action,
      quantity,
      verdict,
      assessment,
      signals: signalMap,
      analystSignals,
    });

    const decision: PortfolioDecision = {
      action,
      quantity,
      price: currentPrice,
      direction: action === "buy" ? "long" : action === "sell" ? "flat" : "flat",
      stopLoss,
      takeProfit,
      weightedScore,
      verdict,
      reasoning,
      signals: signalMap,
    };

    await emit(onEvent, {
      type: "decision_made",
      decision,
      allowed: { maxShares: allowed.maxBuyShares },
    });

    // ---- 8) 执行下单 ----
    let executedOrder: { action: string; quantity: number; price: number } | undefined;
    if ((action === "buy" || action === "sell") && quantity > 0) {
      await progress(95, "执行模拟下单...");
      const execResult = executeOrder({
        portfolio,
        symbol: context.symbol,
        action,
        quantity,
        price: currentPrice,
        stopLoss,
        takeProfit,
        timestamp: new Date().toISOString(),
        caseId,
      });
      portfolio = execResult.portfolio;
      if (!execResult.error) {
        executedOrder = { action, quantity, price: currentPrice };
        savePortfolio(portfolio);
        await emit(onEvent, {
          type: "order_executed",
          action,
          quantity,
          price: currentPrice,
        });
      } else {
        await emit(onEvent, {
          type: "error",
          message: `下单失败：${execResult.error}`,
          recoverable: true,
        });
      }
    }

    // ---- 9) 时间机器回放（如果有SL/TP） ----
    let replayResult: ReturnType<typeof runReplay> | null = null;
    if (isTimeMachine && stopLoss && takeProfit && (action === "buy" || action === "sell") && quantity > 0 && futureBars.length > 0) {
      await progress(97, "时间机器回放中...");
      replayResult = runReplay({
        direction: action === "buy" ? "long" : "short",
        entryPrice: currentPrice,
        stopLoss,
        takeProfit,
        futureBars: futureBars.map(b => ({ timestamp: b.timestamp, open: b.open, high: b.high, low: b.low, close: b.close })),
        maxBars: 5,
      });

      await emit(onEvent, {
        type: "replay_started",
        futureBars: replayResult.replayPath,
        entryPrice: currentPrice,
        stopLoss,
        takeProfit,
        direction: action === "buy" ? "long" : "short",
      } as any);
    }

    // ---- 10) 持久化 ----
    const closedAt = new Date().toISOString();
    const tradeCase: TradeCase = {
      caseId,
      symbol: context.symbol,
      scenario,
      openedAt: startedAt,
      closedAt,
      entryPrice: currentPrice,
      direction: action === "buy" ? "long" : action === "sell" ? "short" : "flat",
      signals: signalMap,
    };
    saveCase(tradeCase);
    saveTraces(traces);

    const position =
      action === "buy" && quantity > 0
        ? `买入 ${quantity} 股 @ ${currentPrice.toFixed(2)}，止损 ${stopLoss?.toFixed(2)}，止盈 ${takeProfit?.toFixed(2)}`
        : action === "sell" && quantity > 0
          ? `卖出 ${quantity} 股 @ ${currentPrice.toFixed(2)}`
          : "观望 / 不操作";

    await emit(onEvent, {
      type: "case_completed",
      caseId,
      verdict: action === "hold" ? "REJECT" : verdict,
      position,
      ...(replayResult ? {
        replay: {
          outcome: replayResult.outcome,
          barsPlayed: replayResult.barsPlayed,
          exitPrice: replayResult.exitPrice,
          exitDate: replayResult.exitDate,
          pnlPerShare: replayResult.pnlPerShare,
          pnlPct: replayResult.pnlPct,
          mfe: replayResult.maxFavorableExcursion,
          mae: replayResult.maxAdverseExcursion,
          path: replayResult.replayPath,
        }
      } : {}),
    } as any);

    return tradeCase;
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await emit(onEvent, { type: "error", message, recoverable: false });

    // 保存失败案件
    const failedCase: TradeCase = {
      caseId,
      symbol: context.symbol,
      scenario: "general",
      openedAt: startedAt,
      closedAt: new Date().toISOString(),
      entryPrice: 0,
      direction: "flat",
      signals: signalMap,
      outcome: "breakeven",
    };
    saveCase(failedCase);
    if (traces.length > 0) saveTraces(traces);
    throw err;
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function buildReasoning(params: {
  weightedScore: number;
  action: TradeAction;
  quantity: number;
  verdict: Verdict;
  assessment: RiskAssessment;
  signals: Record<MasterId, { signal: "bullish" | "bearish" | "neutral"; confidence: number } | null>;
  analystSignals: Record<MasterId, AnalystSignal>;
}): string {
  const { weightedScore, action, quantity, verdict, assessment, analystSignals } = params;
  const parts: string[] = [];
  parts.push(`5 位大师加权得分 ${weightedScore.toFixed(3)}（阈值 ±0.3）→ ${verdict}`);
  const mastersZh: Record<string, string> = {
    buffett: "巴菲特",
    soros: "索罗斯",
    dalio: "达利欧",
    lynch: "林奇",
    livermore: "利弗莫尔",
  };
  for (const [id, sig] of Object.entries(analystSignals)) {
    if (!sig) continue;
    const arrow = sig.direction === "bullish" ? "↑" : sig.direction === "bearish" ? "↓" : "→";
    parts.push(
      `${mastersZh[id] ?? id} ${arrow} ${(sig.confidence * 100).toFixed(0)}%: ${sig.thesis.slice(0, 60)}`,
    );
  }
  if (assessment.circuitBreakerReason) {
    parts.push(`风控：${assessment.circuitBreakerReason}`);
  } else {
    parts.push(
      `风控：允许仓位 ${(assessment.positionLimitPct * 100).toFixed(1)}%，最大 ${assessment.maxBuyShares} 股`,
    );
  }
  if (action === "buy" && quantity > 0) {
    parts.push(`执行：买入 ${quantity} 股`);
  } else if (action === "sell" && quantity > 0) {
    parts.push(`执行：卖出 ${quantity} 股`);
  } else {
    parts.push(`执行：观望不操作`);
  }
  return parts.join("\n");
}

// Avoid unused import warning
void getCase;
void SINGLE_STOCK_STOP_LOSS_PCT;
