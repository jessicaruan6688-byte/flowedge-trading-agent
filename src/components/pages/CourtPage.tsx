"use client";

import { useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import clsx from "clsx";
import {
  ArrowLeft, Play, Square, TrendingUp, TrendingDown, Scale, Shield, Brain,
  CheckCircle2, XCircle, Clock, Loader2, AlertTriangle, ChevronDown,
  Activity, BarChart3, Wallet, Sparkles, RefreshCw, Trophy,
} from "lucide-react";
import {
  AreaChart, Area, LineChart, Line, XAxis, YAxis, Tooltip,
  ResponsiveContainer, CartesianGrid, ReferenceLine, Bar, BarChart,
  ComposedChart, Brush, Legend,
} from "recharts";
import { hkStockSymbols } from "@/lib/navigation";

/* ────────────────────────── Types ────────────────────────── */

type AgentId = "data" | "buffett" | "lynch" | "soros" | "livermore" | "dalio" | "risk" | "pm";
type NodeStatus = "waiting" | "running" | "done" | "error";
type Direction = "bullish" | "bearish" | "neutral";

interface MasterSignal {
  direction: Direction;
  confidence: number;
  thesis: string;
  keyPoints?: string[];
  weightPercent?: number;
  keyMetrics?: Record<string, number | string>;
}

interface KlinePoint {
  t: string; o: number; h: number; l: number; c: number; v: number;
  ma5?: number | null;
  ma20?: number | null;
  ma60?: number | null;
}

interface RiskData {
  positionLimitPct: number;
  maxBuyShares: number;
  annualizedVolatility: number;
  dailyVolatility?: number;
  circuitBreakerActive: boolean;
  circuitBreakerReason?: string;
  warnings?: string[];
  rsi?: number;
  atr?: number;
  atrPct?: number;
  volumeRatio?: number;
}

interface VerdictData {
  action: "buy" | "sell" | "hold";
  quantity: number;
  price: number;
  direction: "long" | "short" | "flat";
  stopLoss?: number;
  takeProfit?: number;
  weightedScore: number;
  verdict: "BUY" | "SELL" | "REJECT";
  reasoning: string;
}

interface ProgressStep {
  label: string;
  status: "waiting" | "running" | "done" | "error";
  time?: string;
}

interface GateNode {
  id: string;
  question: string;
  answer: "yes" | "no";
  result: "proceed" | "wait" | "reject";
  reason: string;
}

interface StrategyContext {
  focus: string;
  prohibited: string[];
  keyIndicators: string[];
  entryStrategy: string;
  invalidationLevel: string;
}

type CourtEvent =
  | { type: "case_started"; caseId: string; symbol: string; timestamp: string }
  | { type: "progress"; percent: number; message: string }
  | { type: "data_loaded"; bars: number; scenario: string; price: number; indicators: Record<string, number>; klines: KlinePoint[]; quote: any; technicals: Record<string, number> }
  | { type: "circuit_breaker"; triggered: boolean; reason?: string }
  | { type: "agent_started"; masterId: string; masterName: string }
  | { type: "agent_signal"; masterId: string; signal: MasterSignal; latencyMs?: number }
  | { type: "risk_assessed"; assessment: RiskData }
  | { type: "decision_made"; decision: VerdictData; allowed: { maxShares: number } }
  | { type: "order_executed"; action: string; quantity: number; price: number }
  | { type: "replay_started"; direction: "long"|"short"; entryPrice: number; stopLoss: number; takeProfit: number; futureBars: Array<{t:string; open?:number; close:number; high:number; low:number; dayIndex?:number; hitTp?:boolean; hitSl?:boolean}>; speed?: number }
  | { type: "case_completed"; caseId: string; verdict: string; position: string; replay?: { outcome:"tp_hit"|"sl_hit"|"timeout"|"no_trade"; pnlPct:number; pnlPerShare?:number; exitPrice:number; exitDate?:string; mfe?:number; mae?:number; barsPlayed?:number } }
  | { type: "error"; message: string }
  | { type: "gate_result"; verdict: "proceed" | "wait" | "reject"; nodes: GateNode[]; marketRegime: string; direction: string; climaxRisk: string }
  | { type: "scenario_classified"; scenario: string; scenarioName: string; confidence: number; description: string; strategyContext: StrategyContext }
  | { type: "trader_equation"; passed: boolean; reason: string; riskRewardRatio: number; estimatedWinRate: number; expectedValue: number; suggestion?: string };

/* ────────────────────────── Master config ────────────────────────── */

const MASTER_CONFIG: Record<string, { name: string; nameEn: string; framework: string; color: string; bgClass: string; textClass: string; borderClass: string; iconBg: string; side: "bull" | "bear" | "center"; icon: string }> = {
  buffett: { name: "巴菲特", nameEn: "Buffett", framework: "价值投资 · 护城河", color: "#10b981", bgClass: "bg-emerald-50", textClass: "text-emerald-700", borderClass: "border-l-emerald-500", iconBg: "bg-emerald-100 text-emerald-700", side: "bull", icon: "B" },
  lynch: { name: "林奇", nameEn: "Lynch", framework: "GARP · 十倍股", color: "#0ea5e9", bgClass: "bg-sky-50", textClass: "text-sky-700", borderClass: "border-l-sky-500", iconBg: "bg-sky-100 text-sky-700", side: "bull", icon: "L" },
  soros: { name: "索罗斯", nameEn: "Soros", framework: "反身性 · 泡沫识别", color: "#ef4444", bgClass: "bg-red-50", textClass: "text-red-700", borderClass: "border-l-red-500", iconBg: "bg-red-100 text-red-700", side: "bear", icon: "S" },
  livermore: { name: "利弗莫尔", nameEn: "Livermore", framework: "动量 · 关键点", color: "#f97316", bgClass: "bg-orange-50", textClass: "text-orange-700", borderClass: "border-l-orange-500", iconBg: "bg-orange-100 text-orange-700", side: "bear", icon: "J" },
  dalio: { name: "达利欧", nameEn: "Dalio", framework: "原则 · 风险平价", color: "#f59e0b", bgClass: "bg-amber-50", textClass: "text-amber-700", borderClass: "border-l-amber-500", iconBg: "bg-amber-100 text-amber-700", side: "center", icon: "D" },
};

const BULL_MASTERS = ["buffett", "lynch"] as const;
const BEAR_MASTERS = ["soros", "livermore"] as const;
const CENTER_MASTERS = ["dalio"] as const;

/* ────────────────────────── Mock stream for demo ────────────────────────── */

function createMockStream(symbol: string, onEvent: (e: Record<string, unknown>) => void, decisionDate?: string) {
  let cancelled = false;
  const delay = (ms: number) => new Promise(r => setTimeout(r, ms));
  const ticker = symbol.replace(".HK", "");

  // Generate fake price data (~2 years = 480 trading days ending at decisionDate or today)
  const basePrice = ticker==="0700" ? 450 : ticker==="0981" ? 380 : ticker==="1810" ? 35 : ticker==="9988" ? 130 : 398.6;
  const klines: KlinePoint[] = [];
  let p = basePrice * 0.7;
  const totalDays = 480;
  const closes: number[] = [];
  // End date = decisionDate (if provided, parsed) or today
  const endDate = decisionDate ? new Date(decisionDate + "T16:00:00+08:00") : new Date();
  // Count backwards 480 trading days from endDate
  let cursor = new Date(endDate);
  const dates: Date[] = [];
  while (dates.length < totalDays) {
    const dow = cursor.getDay();
    if (dow !== 0 && dow !== 6) { // skip weekends
      dates.unshift(new Date(cursor));
    }
    cursor.setDate(cursor.getDate() - 1);
  }
  for (let i = 0; i < totalDays; i++) {
    const drift = (Math.random() - 0.48) * 0.02;
    p = p * (1 + drift);
    const d = dates[i];
    const o = p;
    const c = p * (1 + (Math.random() - 0.5) * 0.025);
    const h = Math.max(o, c) * (1 + Math.random() * 0.015);
    const l = Math.min(o, c) * (1 - Math.random() * 0.015);
    const v = Math.floor(5000000 + Math.random() * 20000000);
    closes.push(c);
    klines.push({ t: d.toISOString(), o, h, l, c, v });
    p = c;
  }
  // Compute MA5/MA20/MA60
  for (let i = 0; i < klines.length; i++) {
    klines[i].ma5 = i >= 4 ? closes.slice(i - 4, i + 1).reduce((a, b) => a + b, 0) / 5 : null;
    klines[i].ma20 = i >= 19 ? closes.slice(i - 19, i + 1).reduce((a, b) => a + b, 0) / 20 : null;
    klines[i].ma60 = i >= 59 ? closes.slice(i - 59, i + 1).reduce((a, b) => a + b, 0) / 60 : null;
  }
  const currentPrice = klines[klines.length - 1].c;
  const changePct = ((currentPrice - klines[0].c) / klines[0].c * 100);

  const mockSignals: Record<string, MasterSignal> = {
    buffett: {
      direction: "bullish", confidence: 78, weightPercent: 20,
      thesis: "从价值投资角度看，当前PE约18倍处于历史中枢偏低位置，ROE维持在20%以上的优秀水平。公司自由现金流充沛，护城河稳固，游戏+广告+云业务三驾马车形成多元支撑。现价相对内在价值存在约15%的安全边际，符合'别人恐惧时我贪婪'的买入原则。长期持有逻辑未被破坏，当前是逐步建仓的好时机。",
      keyPoints: ["护城河稳固，自由现金流持续充沛", "估值具备安全边际，PE低于历史均值", "ROE维持20%+，盈利能力优秀"],
      keyMetrics: { "ROE": "22%", "PE": "18x", "FCF": "正" },
    },
    soros: {
      direction: "bearish", confidence: 55, weightPercent: 20,
      thesis: "当前市场存在反身性过热迹象，散户FOMO情绪推动价格脱离基本面支撑。RSI接近超买区域，放量滞涨信号初现。历史上类似场景往往伴随短期回调，趋势存在自我加强后的反转风险。根据反身性理论，当趋势依赖情绪维持而非基本面时，应警惕繁荣-萧条序列的拐点。建议先观望，等待更明确的信号。",
      keyPoints: ["市场情绪过热，存在反身性风险", "放量滞涨，短期或迎来回调", "等待信号明确再行动，不追高"],
      keyMetrics: { "RSI": "68", "情绪": "贪婪" },
    },
    dalio: {
      direction: "neutral", confidence: 50, weightPercent: 20,
      thesis: "从风险平价原则出发，当前个股年化波动率约25-28%，处于中等偏高水平，单票仓位建议控制在组合的10-15%以内。当前组合现金充足，未触发熔断机制，允许建仓但不宜重仓。分散化原则要求不集中持仓于单一标的，建议小仓位试探。痛苦+反思=进步，每笔交易都要控制好风险暴露。",
      keyPoints: ["波动率偏高，建议小仓位控制风险", "分散化原则下不宜集中持仓", "未触发熔断，允许小仓位试探"],
      keyMetrics: { "波动率": "25%", "仓位上限": "12%" },
    },
    lynch: {
      direction: "bullish", confidence: 62, weightPercent: 20,
      thesis: "从GARP（合理价格买成长）视角看，当前PEG约0.85小于1，成长性被市场低估。AI大模型落地带来新增长曲线，业务简单易懂（互联网平台型公司），符合ten-bagger潜力特征。短期已有一定涨幅，但从2-3年维度看成长空间仍在。这是我喜欢的'在商场里看得到产品'的公司类型。",
      keyPoints: ["PEG小于1，成长性被市场低估", "AI催化新增长曲线，业务易理解", "具备ten-bagger潜力，值得长期持有"],
      keyMetrics: { "PEG": "0.85", "增长率": "15%" },
    },
    livermore: {
      direction: "neutral", confidence: 45, weightPercent: 20,
      thesis: "从关键点交易法来看，价格在EMA21上方但尚未有效突破前高关键点，成交量未确认突破有效。根据我的交易原则，必须等待关键点确认后再行动，此时进场属于左侧交易风险较高。建议耐心sitting等待，若价格放量突破前高并站稳，则是金字塔加仓的好时机；若跌破支撑则立即止损。",
      keyPoints: ["关键点未确认，不提前进场", "等待量能配合的有效突破", "坚持sitting原则，耐心等待时机"],
      keyMetrics: { "ADX": "22", "趋势": "弱" },
    },
  };

  (async () => {
    const send = (e: Record<string, unknown>) => { if (!cancelled) onEvent(e); };

    send({ type: "case_started", caseId: `case-demo-${Date.now().toString(36)}`, symbol, timestamp: new Date().toISOString() });
    await delay(300);

    send({ type: "progress", percent: 5, message: "正在加载市场数据..." });
    await delay(600);

    send({
      type: "data_loaded", bars: totalDays, scenario: "momentum_surge", price: currentPrice,
      indicators: { price: Number(currentPrice.toFixed(2)), rsi: 62, volumeRatio: 1.15, atr: Number((currentPrice * 0.025).toFixed(2)), ma20: Number((currentPrice * 0.97).toFixed(2)), changePct: Number(changePct.toFixed(2)), annualizedVolatility: 0.28 },
      klines,
      quote: { price: Number(currentPrice.toFixed(2)), change: Number((currentPrice - klines[klines.length - 2].c).toFixed(2)), changePercent: Number(changePct.toFixed(2)), high: Number((currentPrice * 1.02).toFixed(2)), low: Number((currentPrice * 0.98).toFixed(2)), volume: klines[klines.length - 1].v },
      technicals: { rsi: 62, ema8: Number((currentPrice * 1.01).toFixed(2)), ema21: Number((currentPrice * 0.97).toFixed(2)), ema55: Number((currentPrice * 0.92).toFixed(2)), macd: 2.3, bollingerUpper: Number((currentPrice * 1.06).toFixed(2)), bollingerLower: Number((currentPrice * 0.94).toFixed(2)), atr: Number((currentPrice * 0.025).toFixed(2)), adx14: 24, volumeRatio: 1.15, volatility20d: 0.28 },
    });
    await delay(400);

    send({ type: "circuit_breaker", triggered: false });
    await delay(200);

    // Gate result (4 gates all proceed)
    send({
      type: "gate_result",
      verdict: "proceed",
      marketRegime: "trend_up",
      direction: "bullish",
      climaxRisk: "low",
      nodes: [
        { id: "g1", question: "数据是否充足?", answer: "yes", result: "proceed", reason: "480根日线数据充足，MA5/20/60 完整" },
        { id: "g2", question: "周期可识别?", answer: "yes", result: "proceed", reason: "上升趋势清晰，高点抬升高点抬升" },
        { id: "g3", question: "是否处于高潮风险?", answer: "no", result: "proceed", reason: "成交量温和，RSI=62 未到超买区" },
        { id: "g4", question: "风控熔断?", answer: "no", result: "proceed", reason: "波动率28%在可控范围，未触发熔断" },
      ],
    });
    await delay(500);

    // Scenario classification
    send({
      type: "scenario_classified",
      scenario: "pullback_buy",
      scenarioName: "回调买入",
      confidence: 72,
      description: "上升趋势中回调到位",
      strategyContext: {
        focus: "关注MA20支撑位与成交量缩量企稳信号",
        prohibited: ["追高", "重仓", "忽略止损"],
        keyIndicators: ["MA20支撑", "缩量企稳", "MACD金叉"],
        entryStrategy: "MA20附近分2-3批建仓",
        invalidationLevel: "跌破MA60立即止损",
      },
    });
    await delay(400);

    // Process each master
    const masters = ["buffett", "lynch", "soros", "livermore", "dalio"];
    for (let i = 0; i < masters.length; i++) {
      const mid = masters[i];
      send({ type: "agent_started", masterId: mid, masterName: MASTER_CONFIG[mid].name });
      await delay(700 + Math.random() * 500);
      send({ type: "agent_signal", masterId: mid, signal: mockSignals[mid], latencyMs: Math.floor(700 + Math.random() * 800) });
      send({ type: "progress", percent: 25 + (i + 1) * 10, message: `${MASTER_CONFIG[mid].name} 分析完成` });
    }

    await delay(400);
    send({ type: "risk_assessed", assessment: { positionLimitPct: 0.12, maxBuyShares: 300, annualizedVolatility: 0.28, circuitBreakerActive: false, warnings: ["波动率略高，建议轻仓"] } });
    await delay(400);

    // Trader equation
    send({
      type: "trader_equation",
      passed: true,
      reason: "盈亏比2.3:1，胜率58%，期望值为正（EV=0.68），满足长期正期望交易要求。",
      riskRewardRatio: 2.3,
      estimatedWinRate: 0.58,
      expectedValue: 0.68,
      suggestion: "可执行，但建议仓位控制在10%以内以控制波动率暴露。",
    });
    await delay(300);

    // Decision based on scenario preset: 中芯FOMO案例REJECT，其他BUY
    const rsi = 62;
    const scenario = "pullback_buy";
    let decisionVerdict: "BUY" | "SELL" | "REJECT" = "BUY";
    let qty = 100;
    let sl = currentPrice * 0.95;
    let tp = currentPrice * 1.08;
    let actionType: "buy"|"sell"|"hold" = "buy";
    // If scenario suggests reject (high RSI / climax), make it REJECT
    if (klines.length > 0 && (rsi > 75 || scenario.includes("fomo") || scenario.includes("overbought"))) {
      decisionVerdict = "REJECT"; qty = 0; actionType = "hold";
    }
    send({
      type: "decision_made",
      decision: { action: actionType, quantity: qty, price: Number(currentPrice.toFixed(2)), direction: actionType==="buy"?"long":"flat", stopLoss: qty>0?Number(sl.toFixed(2)):undefined, takeProfit: qty>0?Number(tp.toFixed(2)):undefined, weightedScore: decisionVerdict==="BUY"?0.42:0.1, verdict: decisionVerdict, reasoning: decisionVerdict==="BUY"?"大师多数看涨，风控通过，交易者方程正期望，建议轻仓做多。":"高潮风险触发，闸门直接拦截，不追高。" },
      allowed: { maxShares: 300 },
    });
    await delay(300);

    const isBuy = (actionType as string) === "buy";
    const isSell = (actionType as string) === "sell";

    if (qty > 0) {
      send({ type: "order_executed", action: actionType, quantity: qty, price: Number(currentPrice.toFixed(2)) });
    }
    await delay(200);

    // Time machine replay (when decisionDate is provided)
    if (decisionDate) {
      const entry = currentPrice;
      const sl = isSell ? entry * 1.05 : entry * 0.95;
      const tp = isSell ? entry * 0.90 : entry * 1.08;
      const futureBars: Array<{t:string; open:number; close:number; high:number; low:number; dayIndex:number; hitTp?:boolean; hitSl?:boolean}> = [];
      let fp = entry;
      // Start from the NEXT trading day after decision date (klines last bar IS decision date)
      const startDate = new Date(klines[klines.length - 1].t);
      startDate.setDate(startDate.getDate() + 1);
      while (startDate.getDay() === 0 || startDate.getDay() === 6) startDate.setDate(startDate.getDate() + 1);
      let tpBar = -1;
      // Drift direction based on verdict: BUY→up, SELL→down, HOLD→flat/slight down
      const dailyDrift = isBuy ? 0.022 : isSell ? -0.022 : -0.003;
      const noise = 0.008;
      for (let i = 0; i < 5; i++) {
        startDate.setDate(startDate.getDate() + 1);
        while (startDate.getDay() === 0 || startDate.getDay() === 6) startDate.setDate(startDate.getDate() + 1);
        const drift = dailyDrift + (Math.random() - 0.5) * noise;
        const o = fp;
        const c = fp * (1 + drift);
        const h = Math.max(o, c) * (1 + Math.random() * 0.008);
        const l = Math.min(o, c) * (1 - Math.random() * 0.008);
        const hitTp = isBuy ? h >= tp : l <= tp;
        const hitSl = isBuy ? l <= sl : h >= sl;
        futureBars.push({
          t: startDate.toISOString(),
          open: Number(o.toFixed(2)),
          close: Number(c.toFixed(2)),
          high: Number(h.toFixed(2)),
          low: Number(l.toFixed(2)),
          dayIndex: i + 1,
          hitTp: (isBuy||isSell) && hitTp,
          hitSl: (isBuy||isSell) && hitSl,
        });
        if ((isBuy||isSell) && hitTp && tpBar < 0) tpBar = i;
        fp = c;
        if ((hitTp || hitSl) && (isBuy||isSell)) {
          for (let j = i + 1; j < 5; j++) {
            startDate.setDate(startDate.getDate() + 1);
            while (startDate.getDay() === 0 || startDate.getDay() === 6) startDate.setDate(startDate.getDate() + 1);
            futureBars.push({
              t: startDate.toISOString(),
              open: Number(fp.toFixed(2)),
              close: Number(fp.toFixed(2)),
              high: Number(fp.toFixed(2)),
              low: Number(fp.toFixed(2)),
              dayIndex: j + 1,
              hitTp: false, hitSl: false,
            });
          }
          break;
        }
      }
      const win = (isBuy && tpBar >= 0) || (isSell && tpBar >= 0);
      send({
        type: "replay_started",
        direction: isBuy ? "long" : "short",
        entryPrice: Number(entry.toFixed(2)),
        stopLoss: Number(sl.toFixed(2)),
        takeProfit: Number(tp.toFixed(2)),
        futureBars,
      });
      await delay(5500);
      const exitBar = (isBuy||isSell) && tpBar >= 0 ? tpBar + 1 : 5;
      const exitPrice = (isBuy||isSell) && tpBar >= 0 ? Number((win?tp:sl).toFixed(2)) : Number(fp.toFixed(2));
      const pnlPct = isBuy ? (exitPrice - entry)/entry : isSell ? (entry - exitPrice)/entry : (fp - entry)/entry;
      const pnlPerShare = isBuy ? exitPrice - entry : isSell ? entry - exitPrice : fp - entry;
      const exitDate = futureBars[exitBar - 1]?.t;
      let mfe = 0, mae = 0;
      for (let i = 0; i < exitBar; i++) {
        const b = futureBars[i];
        if (isBuy) { mfe = Math.max(mfe, (b.high - entry)/entry); mae = Math.min(mae, (b.low - entry)/entry); }
        else if (isSell) { mfe = Math.max(mfe, (entry - b.low)/entry); mae = Math.min(mae, (entry - b.high)/entry); }
      }
      send({
        type: "case_completed",
        caseId: "case-demo",
        verdict: decisionVerdict,
        position: isBuy ? `买入 ${qty} 股 @ ${currentPrice.toFixed(2)}` : isSell ? `卖出 ${qty} 股 @ ${currentPrice.toFixed(2)}` : "拒绝交易",
        replay: {
          outcome: !isBuy && !isSell ? "no_trade" : (tpBar >= 0 ? "tp_hit" : "timeout"),
          pnlPct,
          pnlPerShare: Number(pnlPerShare.toFixed(2)),
          exitPrice,
          exitDate,
          mfe,
          mae: Math.abs(mae),
          barsPlayed: exitBar,
        },
      });
    } else {
      send({ type: "case_completed", caseId: "case-demo", verdict: decisionVerdict, position: isBuy ? `买入 ${qty} 股 @ ${currentPrice.toFixed(2)}` : isSell ? `卖出 ${qty} 股 @ ${currentPrice.toFixed(2)}` : "拒绝交易" });
    }
  })();

  return () => { cancelled = true; };
}

/* ────────────────────────── Helpers ────────────────────────── */

function fmtNum(n: number, d = 2) { return n.toLocaleString("zh-CN", { minimumFractionDigits: d, maximumFractionDigits: d }); }
function fmtPct(n: number) { return `${n > 0 ? "+" : ""}${n.toFixed(2)}%`; }
function fmtVol(n: number) { return n >= 1e8 ? `${(n/1e8).toFixed(2)}亿` : n >= 1e4 ? `${(n/1e4).toFixed(0)}万` : n.toFixed(0); }

/* ────────────────────────── Page ────────────────────────── */

export function CourtPage() {
  const searchParams = useSearchParams();
  const urlSymbol = searchParams.get("symbol") ?? "";
  const urlIdea = searchParams.get("idea") ?? "";
  const urlMode = searchParams.get("mode") ?? "Spot";
  const urlDecisionDate = searchParams.get("decisionDate") ?? "";

  const [symbol, setSymbol] = useState(urlSymbol);
  const [idea, setIdea] = useState(urlIdea);
  const [mode, setMode] = useState(urlMode);
  const [running, setRunning] = useState(false);
  const [selectedTicker, setSelectedTicker] = useState(hkStockSymbols.find(s => s.symbol.includes(symbol.replace(".HK","")))?.name ?? "");

  // Data state
  const [caseId, setCaseId] = useState<string | null>(null);
  const [klines, setKlines] = useState<KlinePoint[]>([]);
  const [quote, setQuote] = useState<{ price: number; change: number; changePercent: number; high: number; low: number; volume: number } | null>(null);
  const [technicals, setTechnicals] = useState<Record<string, number>>({});
  const [scenario, setScenario] = useState<string>("");
  const [indicators, setIndicators] = useState<Record<string, number>>({});

  // Agent state
  const [agentStatus, setAgentStatus] = useState<Record<string, NodeStatus>>({});
  const [signals, setSignals] = useState<Record<string, MasterSignal>>({});
  const [agentLatency, setAgentLatency] = useState<Record<string, number>>({});

  // Results
  const [risk, setRisk] = useState<RiskData | null>(null);
  const [verdict, setVerdict] = useState<VerdictData | null>(null);
  const [orderInfo, setOrderInfo] = useState<{ action: string; quantity: number; price: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [progressSteps, setProgressSteps] = useState<ProgressStep[]>([]);
  const [outputTab, setOutputTab] = useState<"progress" | "summary" | "analysis">("progress");
  const [outputOpen, setOutputOpen] = useState(false);

  // Gate / scenario / trader equation / chat
  const [gateNodes, setGateNodes] = useState<GateNode[]>([]);
  const [gateVerdict, setGateVerdict] = useState<"proceed" | "wait" | "reject" | "">("");
  const [scenarioInfo, setScenarioInfo] = useState<{ scenario: string; scenarioName: string; confidence: number; description: string; strategyContext: StrategyContext } | null>(null);
  const [traderEq, setTraderEq] = useState<{ passed: boolean; reason: string; rr: number; winRate: number; ev: number; suggestion?: string } | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const [chatMessages, setChatMessages] = useState<Array<{ role: "user" | "assistant"; content: string }>>([]);
  const [chatInput, setChatInput] = useState("");

  // Replay / time machine state
  const [replayState, setReplayState] = useState<{
    active: boolean;
    futureBars: Array<{t:string; close:number; high:number; low:number; open?:number; dayIndex:number; hitTp?:boolean; hitSl?:boolean}>;
    entryPrice: number;
    stopLoss: number;
    takeProfit: number;
    direction: "long"|"short";
    currentBarIdx: number; // 已播放到第几根
    playing: boolean;
    speed: number; // 1x/2x/5x
    settled: boolean;
    outcome?: "tp_hit"|"sl_hit"|"timeout"|"no_trade";
    exitPrice?: number;
    exitDate?: string;
    pnlPct?: number;
    pnlPerShare?: number;
    mfe?: number;
    mae?: number;
  } | null>(null);
  const [weightChanges, setWeightChanges] = useState<Array<{masterId:string; masterName:string; delta:number; newWeight:number; correct:boolean}>>([]);

  const abortRef = useRef<AbortController | null>(null);
  const mockCancelRef = useRef<(() => void) | null>(null);
  const replayTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const startReplayAnimation = useCallback((bars: any[], evtData: any) => {
    if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
    let idx = 0;
    const tick = () => {
      idx++;
      setReplayState(prev => {
        if (!prev) return prev;
        return { ...prev, currentBarIdx: Math.min(idx, prev.futureBars.length) };
      });
      if (idx < bars.length) {
        const delay = 800 / (evtData.speed || 1);
        replayTimerRef.current = setTimeout(tick, delay);
      }
    };
    replayTimerRef.current = setTimeout(tick, 600);
  }, []);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (replayTimerRef.current) clearTimeout(replayTimerRef.current);
    };
  }, []);

  const isPositive = quote ? quote.changePercent >= 0 : true;

  // Chart data
  const formatDate = (iso: string) => new Date(iso).toISOString().slice(5, 10);
  const chartData = useMemo(() => {
    if (klines.length === 0) return [] as Array<{
      date: string; price: number | null; future?: number | null; volume: number;
      ema21?: number; ma5: number | null; ma20: number | null; ma60: number | null;
      isFuture: boolean; hitTp?: boolean; hitSl?: boolean; open?: number; high?: number; low?: number;
    }>;
    const base = klines.map((k, i) => ({
      date: k.t.slice(5, 10),
      price: k.c,
      future: null as number | null,
      volume: k.v,
      ema21: technicals.ema21 && i > klines.length - 30 ? technicals.ema21 : undefined,
      ma5: k.ma5 ?? null,
      ma20: k.ma20 ?? null,
      ma60: k.ma60 ?? null,
      isFuture: false,
      open: k.o,
      high: k.h,
      low: k.l,
      hitTp: undefined as boolean | undefined,
      hitSl: undefined as boolean | undefined,
    }));
    // Append replay bars (if active)
    if (replayState && replayState.active && replayState.currentBarIdx > 0) {
      const visibleFuture = replayState.futureBars.slice(0, replayState.currentBarIdx);
      for (const fb of visibleFuture) {
        base.push({
          date: formatDate(fb.t),
          price: fb.close,
          future: fb.close,
          volume: 0,
          ema21: undefined,
          ma5: null, ma20: null, ma60: null,
          isFuture: true,
          hitTp: fb.hitTp,
          hitSl: fb.hitSl,
          open: fb.open ?? fb.close,
          high: fb.high,
          low: fb.low,
        });
      }
    }
    return base;
  }, [klines, technicals, replayState]);

  // Compute decision path nodes
  const gateNodeStatus = (idx: number): "pass" | "fail" | "active" | "pending" => {
    const n = gateNodes[idx];
    if (n) {
      if (n.answer === "yes" && n.result === "proceed") return "pass";
      return "fail";
    }
    // previous gates all passed => current active when running
    const prevAllPass = idx === 0 || gateNodes.slice(0, idx).every(g => g.answer === "yes" && g.result === "proceed");
    if (running && gateVerdict === "" && prevAllPass && gateNodes.length === idx) return "active";
    return "pending";
  };

  const mastersDone = ["buffett", "lynch", "soros", "livermore", "dalio"];
  const anyMasterRunning = mastersDone.some(m => agentStatus[m] === "running");
  const allMastersDone = scenarioInfo != null && mastersDone.every(m => agentStatus[m] === "done");
  const mastersStarted = mastersDone.some(m => agentStatus[m] === "running" || agentStatus[m] === "done");

  let scenarioStatus: "pass" | "fail" | "active" | "pending";
  if (scenarioInfo) scenarioStatus = "pass";
  else if (gateVerdict === "proceed" && !allMastersDone) scenarioStatus = "active";
  else scenarioStatus = "pending";

  let debateStatus: "pass" | "fail" | "active" | "pending";
  if (allMastersDone) debateStatus = "pass";
  else if (anyMasterRunning || mastersStarted) debateStatus = "active";
  else if (gateVerdict === "proceed" || scenarioInfo) debateStatus = "pending";
  else debateStatus = "pending";

  let eqStatus: "pass" | "fail" | "active" | "pending";
  let eqLabel = "交易者方程";
  if (traderEq) {
    eqStatus = traderEq.passed ? "pass" : "fail";
    eqLabel = traderEq.passed ? `R:R=${traderEq.rr.toFixed(1)} ✓` : "方程未通过 ✗";
  } else if (allMastersDone && !verdict) {
    eqStatus = "active";
  } else {
    eqStatus = "pending";
  }

  let finalStatus: "pass" | "fail" | "active" | "pending";
  let finalLabel = "最终裁决";
  if (verdict) {
    if (verdict.verdict === "BUY" || verdict.verdict === "SELL") {
      finalStatus = "pass";
      finalLabel = verdict.verdict === "BUY" ? "✓ BUY" : "✓ SELL";
    } else {
      finalStatus = "fail";
      finalLabel = "✗ REJECT";
    }
  } else if (traderEq) {
    finalStatus = "active";
  } else {
    finalStatus = "pending";
  }

  const pathNodes: Array<{ id: string; label: string; status: "pass" | "fail" | "active" | "pending" }> = [
    { id: "g1", label: "数据充足?", status: gateNodeStatus(0) },
    { id: "g2", label: "周期可识别?", status: gateNodeStatus(1) },
    { id: "g3", label: "高潮风险?", status: gateNodeStatus(2) },
    { id: "g4", label: "风控熔断?", status: gateNodeStatus(3) },
    { id: "scenario", label: scenarioInfo ? `场景:${scenarioInfo.scenarioName}` : "场景识别", status: scenarioStatus },
    { id: "debate", label: "5大师辩论", status: debateStatus },
    { id: "eq", label: eqLabel, status: eqStatus },
    { id: "final", label: finalLabel, status: finalStatus },
  ];

  const resetState = useCallback(() => {
    setCaseId(null);
    setKlines([]);
    setQuote(null);
    setTechnicals({});
    setScenario("");
    setIndicators({});
    setAgentStatus({});
    setSignals({});
    setAgentLatency({});
    setRisk(null);
    setVerdict(null);
    setOrderInfo(null);
    setError(null);
    setProgressSteps([]);
    setOutputOpen(false);
    setGateNodes([]);
    setGateVerdict("");
    setScenarioInfo(null);
    setTraderEq(null);
    setChatOpen(false);
    setChatMessages([]);
    setChatInput("");
    if (replayTimerRef.current) {
      clearTimeout(replayTimerRef.current);
      replayTimerRef.current = null;
    }
    setReplayState(null);
    setWeightChanges([]);
  }, []);

  const dispatchEvent = useCallback((evt: Record<string, unknown>) => {
    const t = evt.type as string;
    const now = new Date().toLocaleTimeString("zh-CN", { hour12: false });

    if (t === "case_started") {
      setCaseId(evt.caseId as string);
      setProgressSteps([{ label: "案件已立案", status: "done", time: now }]);
      setOutputOpen(true);
    } else if (t === "data_loaded") {
      if (evt.klines) setKlines(evt.klines as KlinePoint[]);
      if (evt.quote) setQuote(evt.quote as any);
      if (evt.technicals) setTechnicals(evt.technicals as any);
      if (evt.scenario) setScenario(evt.scenario as string);
      if (evt.indicators) setIndicators(evt.indicators as any);
      setAgentStatus(prev => ({ ...prev, data: "done" }));
      setProgressSteps(prev => [...prev, { label: `行情数据加载完成 (${evt.bars}根K线)`, status: "done", time: now }]);
    } else if (t === "circuit_breaker") {
      if (!evt.triggered) {
        setProgressSteps(prev => [...prev, { label: "风控熔断检查通过", status: "done", time: now }]);
      }
    } else if (t === "agent_started") {
      const mid = evt.masterId as string;
      setAgentStatus(prev => ({ ...prev, [mid]: "running" }));
      setProgressSteps(prev => [...prev, { label: `${MASTER_CONFIG[mid]?.name ?? mid} 开始分析...`, status: "running", time: now }]);
    } else if (t === "agent_signal") {
      const mid = evt.masterId as string;
      setAgentStatus(prev => ({ ...prev, [mid]: "done" }));
      setSignals(prev => ({ ...prev, [mid]: evt.signal as MasterSignal }));
      if (evt.latencyMs) setAgentLatency(prev => ({ ...prev, [mid]: evt.latencyMs as number }));
      setProgressSteps(prev => {
        const copy = [...prev];
        const lastRunning = [...copy].reverse().findIndex(s => s.status === "running");
        if (lastRunning >= 0) copy[copy.length - 1 - lastRunning].status = "done";
        return copy;
      });
    } else if (t === "risk_assessed") {
      setRisk(evt.assessment as any);
      setAgentStatus(prev => ({ ...prev, risk: "done" }));
      setProgressSteps(prev => [...prev, { label: "风控评估完成", status: "done", time: now }]);
    } else if (t === "decision_made") {
      setVerdict(evt.decision as any);
      setAgentStatus(prev => ({ ...prev, pm: "done" }));
      setProgressSteps(prev => [...prev, { label: "组合经理做出最终裁决", status: "done", time: now }]);
    } else if (t === "order_executed") {
      setOrderInfo({ action: evt.action as string, quantity: evt.quantity as number, price: evt.price as number });
      setProgressSteps(prev => [...prev, { label: `模拟下单执行: ${evt.action} ${evt.quantity}股`, status: "done", time: now }]);
    } else if (t === "replay_started") {
      // 开始回放
      const futureBars = (evt.futureBars as any[]) || [];
      setReplayState({
        active: true,
        futureBars,
        entryPrice: evt.entryPrice as number,
        stopLoss: evt.stopLoss as number,
        takeProfit: evt.takeProfit as number,
        direction: (evt.direction as "long"|"short") ?? "long",
        currentBarIdx: 0,
        playing: true,
        speed: 1,
        settled: false,
      });
      setProgressSteps(prev => [...prev, { label: "⏱ 时间机器回放启动：模拟未来走势", status: "running", time: now }]);
      // 启动动画定时器
      startReplayAnimation(futureBars, evt as any);
    } else if (t === "case_completed") {
      setCaseId(evt.caseId as string);
      setRunning(false);
      setOutputOpen(true);
      setChatOpen(true);
      setProgressSteps(prev => [...prev, { label: `分析完成: ${evt.verdict}`, status: "done", time: now }]);
      // 处理 replay 结算
      const replayEvt = evt.replay as { outcome:"tp_hit"|"sl_hit"|"timeout"|"no_trade"; pnlPct:number; pnlPerShare?:number; exitPrice:number; exitDate?:string; mfe?:number; mae?:number; barsPlayed?:number } | undefined;
      if (replayEvt) {
        setReplayState(prev => prev ? {
          ...prev,
          playing: false,
          settled: true,
          outcome: replayEvt.outcome,
          exitPrice: replayEvt.exitPrice,
          exitDate: replayEvt.exitDate,
          pnlPerShare: replayEvt.pnlPerShare,
          pnlPct: replayEvt.pnlPct,
          mfe: replayEvt.mfe,
          mae: replayEvt.mae,
          currentBarIdx: replayEvt.barsPlayed ?? prev.futureBars.length,
        } : null);
        // 停止动画定时器
        if (replayTimerRef.current) {
          clearTimeout(replayTimerRef.current);
          replayTimerRef.current = null;
        }
        // 模拟权重变化（mock，因为后端还没调weight-store updateWeights）
        // 赢了的大师+0.1，输了-0.08
        const correct = replayEvt.outcome === "tp_hit";
        const changes = Object.entries(signals).map(([mid, sig]) => {
          const isRight = correct ? sig.direction === "bullish" : sig.direction === "bearish";
          const delta = isRight ? 0.1 : -0.08;
          return {
            masterId: mid,
            masterName: MASTER_CONFIG[mid]?.name ?? mid,
            delta,
            newWeight: 1.0 + delta,
            correct: isRight,
          };
        });
        setWeightChanges(changes);
        setProgressSteps(prev => [...prev, {
          label: `⏱ 时间机器结算: ${replayEvt.outcome === "tp_hit" ? "止盈触发" : replayEvt.outcome === "sl_hit" ? "止损触发" : replayEvt.outcome === "no_trade" ? "未开仓" : "到期未触发"} (${(replayEvt.pnlPct*100).toFixed(2)}%)`,
          status: replayEvt.outcome === "tp_hit" ? "done" : "error",
          time: now,
        }]);
      }
    } else if (t === "gate_result") {
      const nodes = evt.nodes as GateNode[];
      const verdict = evt.verdict as "proceed" | "wait" | "reject";
      setGateNodes(nodes);
      setGateVerdict(verdict);
      setProgressSteps(prev => [...prev, { label: `四道闸门判定: ${verdict === "proceed" ? "通过" : verdict === "wait" ? "等待" : "拒绝"}`, status: verdict === "proceed" ? "done" : "error", time: now }]);
      if (verdict !== "proceed") {
        setRunning(false);
      }
    } else if (t === "scenario_classified") {
      setScenarioInfo({
        scenario: evt.scenario as string,
        scenarioName: evt.scenarioName as string,
        confidence: evt.confidence as number,
        description: evt.description as string,
        strategyContext: evt.strategyContext as StrategyContext,
      });
      setProgressSteps(prev => [...prev, { label: `场景识别: ${evt.scenarioName} (${evt.confidence}%)`, status: "done", time: now }]);
    } else if (t === "trader_equation") {
      setTraderEq({
        passed: evt.passed as boolean,
        reason: evt.reason as string,
        rr: evt.riskRewardRatio as number,
        winRate: evt.estimatedWinRate as number,
        ev: evt.expectedValue as number,
        suggestion: evt.suggestion as string | undefined,
      });
      setProgressSteps(prev => [...prev, { label: `交易者方程: ${evt.passed ? "通过" : "未通过"} (R:R ${(evt.riskRewardRatio as number).toFixed(2)})`, status: (evt.passed as boolean) ? "done" : "error", time: now }]);
    } else if (t === "error") {
      setError(evt.message as string);
      setRunning(false);
      setProgressSteps(prev => [...prev, { label: `错误: ${evt.message}`, status: "error", time: now }]);
    }
  }, []);

  const startAnalysis = useCallback(async () => {
    if (!symbol) return;
    resetState();
    setRunning(true);

    // Find stock name
    const cleanSymbol = symbol.replace(".HK", "").padStart(4, "0");
    const found = hkStockSymbols.find(s => s.symbol.startsWith(cleanSymbol));
    setSelectedTicker(found?.name ?? cleanSymbol);
    const finalSymbol = cleanSymbol + ".HK";

    // Initialize all agents to waiting
    const initial: Record<string, NodeStatus> = { data: "waiting", buffett: "waiting", lynch: "waiting", soros: "waiting", livermore: "waiting", dalio: "waiting", risk: "waiting", pm: "waiting" };
    setAgentStatus(initial);

    // Set data to running
    setAgentStatus(prev => ({ ...prev, data: "running" }));

    // Use real SSE by default; mock only if ?mock=1 in URL or API fails
    const urlMock = searchParams.get("mock") === "1";
    const useMock = urlMock;
    if (useMock) {
      const cancel = createMockStream(finalSymbol, dispatchEvent, urlDecisionDate || undefined);
      mockCancelRef.current = cancel;
      return;
    }

    // Real SSE connection
    const controller = new AbortController();
    abortRef.current = controller;

    try {
      const resp = await fetch("/api/court/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol: finalSymbol, userIdea: idea, mode, decisionDate: urlDecisionDate || undefined }),
        signal: controller.signal,
      });
      const reader = resp.body!.getReader();
      const decoder = new TextDecoder();
      let buf = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += decoder.decode(value, { stream: true });
        const lines = buf.split("\n");
        buf = lines.pop() ?? "";
        for (const line of lines) {
          if (line.startsWith("data: ")) {
            try { dispatchEvent(JSON.parse(line.slice(6))); } catch {}
          }
        }
      }
    } catch (e: any) {
      if (e.name !== "AbortError") {
        dispatchEvent({ type: "error", message: String(e.message || e) });
      }
    } finally {
      setRunning(false);
    }
  }, [symbol, idea, mode, resetState, dispatchEvent]);

  const stopAnalysis = useCallback(() => {
    abortRef.current?.abort();
    if (mockCancelRef.current) mockCancelRef.current();
    setRunning(false);
    setProgressSteps(prev => [...prev, { label: "分析已停止", status: "error", time: new Date().toLocaleTimeString("zh-CN", { hour12: false }) }]);
  }, []);

  // Auto-start when URL has params
  useEffect(() => {
    if (urlSymbol && !caseId && !running) {
      const t = setTimeout(() => startAnalysis(), 500);
      return () => clearTimeout(t);
    }
  }, [urlSymbol]); // eslint-disable-line

  /* ────────────────────────── Render components ────────────────────────── */

  const MasterCard = ({ mid }: { mid: string }) => {
    const cfg = MASTER_CONFIG[mid];
    const status = agentStatus[mid] ?? "waiting";
    const sig = signals[mid];
    const latency = agentLatency[mid];
    const isRunning = status === "running";
    const isDone = status === "done";

    return (
      <div className={clsx(
        "rounded-lg border bg-white shadow-sm overflow-hidden transition-all duration-300",
        isDone && sig ? (sig.direction === "bullish" ? "border-emerald-200 shadow-emerald-50" : sig.direction === "bearish" ? "border-red-200 shadow-red-50" : "border-gray-200") : "border-gray-200",
        isRunning && "ring-2 ring-blue-400/40 shadow-lg shadow-blue-100/50 animate-pulse-slow"
      )}>
        {/* Header */}
        <div className={clsx("flex items-center gap-3 px-3 py-2.5", cfg.bgClass)}>
          <div className={clsx("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg font-bold text-sm", cfg.iconBg)}>
            {isRunning ? <Loader2 className="h-4 w-4 animate-spin" /> : cfg.icon}
          </div>
            <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-gray-900">{cfg.name}</span>
              <span className="text-[10px] text-gray-500 font-mono">{cfg.nameEn}</span>
              {isDone && sig && sig.weightPercent != null && (
                <span className="ml-auto text-[11px] text-gray-400">权重 {Math.round(sig.weightPercent)}%</span>
              )}
              {isDone && sig && (
                <span className={clsx(
                  "rounded px-1.5 py-0.5 text-[10px] font-bold",
                  sig.direction === "bullish" && "bg-emerald-100 text-emerald-700",
                  sig.direction === "bearish" && "bg-red-100 text-red-700",
                  sig.direction === "neutral" && "bg-gray-100 text-gray-600",
                )}>
                  {sig.direction === "bullish" ? "BULL" : sig.direction === "bearish" ? "BEAR" : "NEUT"}
                </span>
              )}
            </div>
            <div className="text-[10px] text-gray-500">{cfg.framework}</div>
          </div>
        </div>

        {/* Body */}
        <div className="p-3">
          {status === "waiting" && (
            <div className="flex items-center gap-2 py-3 text-xs text-gray-400">
              <Clock className="h-3 w-3" />
              等待分析...
            </div>
          )}
          {isRunning && (
            <div>
              <div className="flex items-center gap-2 text-xs text-gray-500 mb-2">
                <Loader2 className="h-3 w-3 animate-spin" />
                正在分析市场数据...
              </div>
              <div className="h-1 bg-gray-100 rounded-full overflow-hidden">
                <div className="h-full bg-gradient-to-r from-blue-500 via-indigo-500 to-purple-500 animate-pulse" style={{ width: "60%" }} />
              </div>
            </div>
          )}
          {isDone && sig && (
            <div>
              <p className="text-[13px] leading-[1.6] text-gray-700 mb-2 whitespace-pre-line">{sig.thesis}</p>
              {sig.keyPoints && sig.keyPoints.length > 0 && (
                <ul className="mt-2 space-y-1">
                  {sig.keyPoints.slice(0, 3).map((p, i) => (
                    <li key={i} className="flex items-start gap-1.5 text-[12px] text-gray-600">
                      <span className="mt-1 h-1 w-1 shrink-0 rounded-full" style={{ backgroundColor: cfg.color }} />
                      <span>{p}</span>
                    </li>
                  ))}
                </ul>
              )}
              {sig.keyMetrics && Object.keys(sig.keyMetrics).length > 0 && (
                <div className="flex flex-wrap gap-1 mt-2 mb-2">
                  {Object.entries(sig.keyMetrics).map(([k, v]) => (
                    <span key={k} className="rounded font-mono bg-blue-50 px-1.5 py-0.5 text-[10px] text-blue-700">
                      {k}: {v}
                    </span>
                  ))}
                </div>
              )}
              {/* Confidence bar */}
              <div className="mt-2">
                <div className="flex justify-between text-[10px] text-gray-500 mb-0.5">
                  <span>置信度</span>
                  <span className="font-mono font-semibold" style={{ color: cfg.color }}>{Math.round(sig.confidence)}%</span>
                </div>
                <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all duration-700"
                    style={{ width: `${sig.confidence}%`, backgroundColor: cfg.color }}
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        {isDone && (
          <div className="flex items-center justify-between border-t border-gray-50 px-3 py-1.5 text-[10px] text-gray-400">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3 w-3 text-emerald-500" />
              完成
            </span>
            {latency && <span className="font-mono">{latency}ms</span>}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="flex h-full flex-col bg-gray-50">
      {/* ── Top Control Bar ── */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-2.5">
        <div className="flex items-center gap-3">
          <Link href="/workspace" className="flex items-center gap-1 rounded-md px-2 py-1 text-sm text-gray-500 hover:bg-gray-100 hover:text-gray-700">
            <ArrowLeft className="h-4 w-4" />
          </Link>

          {/* Ticker selector */}
          <div className="flex items-center gap-2">
            <div className="relative">
              <select
                value={symbol}
                onChange={e => { setSymbol(e.target.value); const f = hkStockSymbols.find(s => s.symbol === e.target.value); setSelectedTicker(f?.name ?? ""); }}
                disabled={running}
                className="h-8 appearance-none rounded-md border border-gray-200 bg-white pl-3 pr-8 text-sm font-semibold text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
              >
                <option value="">选择股票</option>
                {hkStockSymbols.map(s => (
                  <option key={s.symbol} value={s.symbol}>{s.symbol.replace(".HK","")} {s.name}</option>
                ))}
              </select>
              <ChevronDown className="pointer-events-none absolute right-2 top-1/2 h-3 w-3 -translate-y-1/2 text-gray-400" />
            </div>
            <span className="rounded-md bg-gray-100 px-2 py-1 text-xs text-gray-600">{mode}</span>
          </div>

          {/* Idea input */}
          <input
            value={idea}
            onChange={e => setIdea(e.target.value)}
            placeholder="输入投资想法..."
            disabled={running}
            className="h-8 flex-1 rounded-md border border-gray-200 bg-white px-3 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/20"
          />

          {/* Run/Stop */}
          {!running ? (
            <button
              onClick={startAnalysis}
              disabled={!symbol}
              className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-blue-50/80 border border-blue-200 px-5 text-sm font-medium text-blue-700 hover:bg-blue-100 disabled:opacity-40 active:scale-[0.98] transition-all"
            >
              <Play className="h-3.5 w-3.5 fill-current" />
              开始分析
            </button>
          ) : (
            <button
              onClick={stopAnalysis}
              className="inline-flex h-8 items-center gap-1.5 rounded-md bg-gray-200 px-4 text-sm font-medium text-gray-700 hover:bg-gray-300 transition-colors"
            >
              <Square className="h-3 w-3 fill-current" />
              停止
            </button>
          )}
        </div>
      </div>

      {/* ── Ticker Info Bar ── */}
      {quote && (
        <div className="shrink-0 border-b border-gray-200 bg-white px-4 py-2">
          <div className="flex items-center gap-5">
            <div>
              <div className="flex items-baseline gap-2">
                <span className="text-base font-bold text-gray-900">{selectedTicker}</span>
                <span className="font-mono text-xs text-gray-500">{symbol}</span>
              </div>
            </div>
            <div>
              <div className={clsx("text-xl font-bold font-mono", isPositive ? "text-emerald-600" : "text-red-600")}>
                HK${fmtNum(quote.price)}
              </div>
            </div>
            <div className={clsx("flex items-center gap-1 rounded px-2 py-0.5 text-sm font-semibold", isPositive ? "bg-emerald-50 text-emerald-700" : "bg-red-50 text-red-700")}>
              {isPositive ? <TrendingUp className="h-3.5 w-3.5" /> : <TrendingDown className="h-3.5 w-3.5" />}
              {fmtPct(quote.changePercent)}
            </div>
            <div className="flex items-center gap-4 text-[11px] text-gray-500 font-mono">
              <span>高 <span className="text-gray-700">{fmtNum(quote.high)}</span></span>
              <span>低 <span className="text-gray-700">{fmtNum(quote.low)}</span></span>
              <span>量 <span className="text-gray-700">{fmtVol(quote.volume)}</span></span>
            </div>
            <div className="ml-auto flex items-center gap-2">
              {Object.entries({
                RSI: technicals.rsi,
                MA20: indicators.ma20,
                ATR: technicals.atr && quote ? `${fmtNum((technicals.atr/quote.price)*100,1)}%` : undefined,
                ADX: technicals.adx14,
                量比: technicals.volumeRatio,
                波动: indicators.annualizedVolatility ? `${(indicators.annualizedVolatility*100).toFixed(0)}%` : undefined,
              }).filter(([,v]) => v !== undefined).map(([k, v]) => (
                <div key={k} className="rounded bg-gray-50 px-2 py-1 border border-gray-100">
                  <div className="text-[9px] text-gray-400 uppercase">{k}</div>
                  <div className="text-[11px] font-mono font-semibold text-gray-700">{v}</div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Decision Path Bar ── */}
      <div className="shrink-0 border-b border-gray-200 bg-white px-4">
        <div className="flex items-center gap-2 overflow-x-auto py-2">
          <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wider text-gray-400">决策路径</span>
          {pathNodes.map((node, i) => (
            <div key={node.id} className="flex items-center shrink-0">
              <div className={clsx(
                "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-medium transition-all duration-300",
                node.status === "pass" && "border-emerald-300 bg-emerald-50 text-emerald-700",
                node.status === "fail" && "border-red-300 bg-red-50 text-red-700",
                node.status === "active" && "border-blue-500 bg-blue-50 text-blue-700 animate-pulse",
                node.status === "pending" && "border-gray-200 bg-gray-50 text-gray-400",
              )}>
                <span className={clsx(
                  "h-1.5 w-1.5 rounded-full",
                  node.status === "pass" && "bg-emerald-500",
                  node.status === "fail" && "bg-red-500",
                  node.status === "active" && "bg-blue-500",
                  node.status === "pending" && "bg-gray-300",
                )} />
                {node.label}
              </div>
              {i < pathNodes.length - 1 && (
                <div className={clsx(
                  "h-px w-4",
                  node.status === "fail" ? "bg-red-300" : node.status === "pass" ? "bg-emerald-300" : "bg-gray-200",
                )} />
              )}
            </div>
          ))}
        </div>

        {/* ── Gate Detail Panel ── */}
        {gateNodes.length > 0 && (
          <div className="border-b border-gray-100 bg-gray-50/50 px-4 py-3">
            <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
              {gateNodes.map((node, idx) => {
                const pass = node.answer === "yes" && node.result === "proceed";
                const Icon = pass ? CheckCircle2 : (node.result === "wait" ? Clock : XCircle);
                return (
                  <div key={node.id} className={clsx(
                    "rounded-lg border px-3 py-2 transition-colors",
                    pass ? "border-emerald-200 bg-emerald-50/50" : "border-red-200 bg-red-50/50",
                  )}>
                    <div className="flex items-center gap-1.5">
                      <Icon className={clsx("h-3.5 w-3.5 shrink-0", pass ? "text-emerald-600" : "text-red-600")} />
                      <span className="text-[11px] font-semibold text-gray-900">
                        G{idx + 1}. {node.question}
                      </span>
                      <span className={clsx(
                        "ml-auto rounded px-1.5 py-0.5 text-[10px] font-bold text-white",
                        pass ? "bg-emerald-600" : "bg-red-600",
                      )}>
                        {pass ? "通过" : node.result === "wait" ? "等待" : "驳回"}
                      </span>
                    </div>
                    <p className={clsx(
                      "mt-1 text-[11px] leading-relaxed",
                      pass ? "text-emerald-800" : "text-red-800",
                    )}>
                      {node.reason}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── Main Content ── */}
      <div className="flex-1 overflow-auto p-4">
        {/* Price Chart - always shown when data loaded */}
        {klines.length > 0 && (
          <div className="mb-4 rounded-lg border border-gray-200 bg-white shadow-sm overflow-hidden">
            <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-semibold text-gray-900">价格走势</span>
                <span className="text-[10px] text-gray-400">近2年日线</span>
                {urlDecisionDate && (
                  <span className="ml-2 inline-flex items-center gap-1 rounded-md bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700 ring-1 ring-amber-200">
                    <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                    决策日 {urlDecisionDate}
                  </span>
                )}
              </div>
              {verdict && verdict.stopLoss && (
                <div className="flex items-center gap-3 text-[10px] font-mono">
                  <span className="flex items-center gap-1 text-emerald-600"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />TP {fmtNum(verdict.takeProfit!)}</span>
                  <span className="flex items-center gap-1 text-red-600"><span className="h-1.5 w-1.5 rounded-full bg-red-500" />SL {fmtNum(verdict.stopLoss)}</span>
                </div>
              )}
            </div>
            <div className="h-56 p-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={chartData} margin={{ top: 5, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="priceGrad" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="0%" stopColor="#007acc" stopOpacity={0.08} />
                      <stop offset="100%" stopColor="#007acc" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" vertical={false} />
                  <XAxis dataKey="date" tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} axisLine={false} interval={replayState?.active ? 19 : 59} />
                  <YAxis tick={{ fontSize: 9, fill: "#9ca3af" }} tickLine={false} axisLine={false} domain={["dataMin * 0.95", "dataMax * 1.05"]} width={50} tickFormatter={v => v.toFixed(0)} />
                  <Tooltip
                    contentStyle={{ fontSize: 11, borderRadius: 6, border: "1px solid #e5e7eb", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                    labelStyle={{ fontWeight: 600 }}
                    formatter={(v: any, n: any) => {
                      const labels: Record<string, string> = { price: "价格", ma5: "MA5", ma20: "MA20", ma60: "MA60" };
                      return v == null ? ["--", labels[n] ?? n] : [Number(v).toFixed(2), labels[n] ?? n];
                    }}
                  />
                  <Legend
                    verticalAlign="top"
                    align="right"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 10, paddingBottom: 2 }}
                    formatter={(value: string) => {
                      const map: Record<string, string> = { price: "价格", ma5: "MA5", ma20: "MA20", ma60: "MA60" };
                      return map[value] ?? value;
                    }}
                  />
                  <Area type="monotone" dataKey="price" name="price" stroke="#007acc" strokeWidth={2} fill="url(#priceGrad)" dot={false} connectNulls={false} />
                  {replayState?.active && (
                    <Line type="monotone" dataKey="future" name="future" stroke="#007acc" strokeWidth={2} strokeDasharray="3 3" strokeOpacity={0.9} dot={{ r: 2.5, fill: "#007acc", strokeWidth: 0 }} activeDot={{ r: 4 }} connectNulls={false} />
                  )}
                  <Line type="monotone" dataKey="ma5" name="ma5" stroke="#f97316" strokeWidth={1} dot={false} connectNulls strokeDasharray="0" />
                  <Line type="monotone" dataKey="ma20" name="ma20" stroke="#14b8a6" strokeWidth={0.8} dot={false} connectNulls />
                  <Line type="monotone" dataKey="ma60" name="ma60" stroke="#8b5cf6" strokeWidth={0.8} dot={false} connectNulls strokeDasharray="3 2" />
                  {replayState?.active && klines.length > 0 && (
                    <ReferenceLine x={chartData[klines.length - 1]?.date} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={2} label={{ value: `▼ 决策日 ${urlDecisionDate || ""}`, fill: "#d97706", fontSize: 11, fontWeight: 700, position: "insideTopLeft", offset: 5 }} />
                  )}
                  {verdict && verdict.action === "buy" && (
                    <ReferenceLine y={verdict.price} stroke="#3b82f6" strokeDasharray="4 2" strokeWidth={1} label={{ value: "ENTRY", fill: "#3b82f6", fontSize: 9, position: "right" }} />
                  )}
                  {verdict && verdict.stopLoss && (
                    <ReferenceLine y={verdict.stopLoss} stroke="#ef4444" strokeDasharray="3 3" strokeWidth={1} label={{ value: "SL", fill: "#ef4444", fontSize: 9, position: "right" }} />
                  )}
                  {verdict && verdict.takeProfit && (
                    <ReferenceLine y={verdict.takeProfit} stroke="#10b981" strokeDasharray="3 3" strokeWidth={1} label={{ value: "TP", fill: "#10b981", fontSize: 9, position: "right" }} />
                  )}
                  {replayState?.settled && replayState.exitPrice != null && (
                    <ReferenceLine y={replayState.exitPrice} stroke="#111827" strokeDasharray="6 3" strokeWidth={1.5} label={{ value: "EXIT", fill: "#111827", fontSize: 9, position: "right" }} />
                  )}
                  <Brush dataKey="date" height={20} stroke="#007acc" fill="#f0f7ff" startIndex={Math.max(0, chartData.length - 120)} travellerWidth={8} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            {/* Volume bar */}
            <div className="h-16 px-2 pb-1">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 0, right: 10, left: 0, bottom: 0 }}>
                  <XAxis dataKey="date" hide />
                  <YAxis hide domain={[0, "dataMax * 2"]} />
                  <Bar dataKey="volume" fill="#e5e7eb" radius={[1,1,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Scenario info card */}
        {scenarioInfo && (
          <div className="mb-4 rounded-lg border border-blue-200 bg-blue-50/50 px-4 py-3">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <div className="flex items-center gap-2">
                <span className="rounded bg-blue-600 px-1.5 py-0.5 text-[10px] font-semibold text-white">场景识别</span>
                <span className="text-sm font-semibold text-blue-900">{scenarioInfo.scenarioName}</span>
                <span className="text-[11px] text-blue-600">置信度 {scenarioInfo.confidence}%</span>
              </div>
              <span className="text-[11px] text-blue-700">{scenarioInfo.description}</span>
            </div>
            <div className="mt-2 grid grid-cols-1 gap-1.5 sm:grid-cols-2">
              <div className="flex items-center gap-1.5 text-[11px] text-blue-800">
                <span className="font-semibold text-blue-900">分析重点：</span>
                {scenarioInfo.strategyContext.focus}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-blue-800">
                <span className="font-semibold text-blue-900">入场策略：</span>
                {scenarioInfo.strategyContext.entryStrategy}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-blue-800">
                <span className="font-semibold text-blue-900">失效位：</span>
                {scenarioInfo.strategyContext.invalidationLevel}
              </div>
              <div className="flex items-center gap-1.5 text-[11px] text-red-700">
                <span className="font-semibold">禁止：</span>
                {scenarioInfo.strategyContext.prohibited.join("、")}
              </div>
            </div>
            <div className="mt-2 flex flex-wrap gap-1.5">
              {scenarioInfo.strategyContext.keyIndicators.map(ind => (
                <span key={ind} className="rounded bg-blue-100 px-1.5 py-0.5 text-[10px] font-medium text-blue-700">{ind}</span>
              ))}
            </div>
          </div>
        )}

        {/* Replay controls / time machine */}
        {replayState && (
          <div className="mb-4 rounded-lg border border-amber-200 bg-amber-50/40 p-4">
            <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-900">⏱ 时间机器回放</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="rounded-md bg-amber-100 px-2 py-0.5 text-[10px] font-mono font-bold text-amber-800 border border-amber-200">
                  决策日 {urlDecisionDate || "--"}
                </span>
                <span className="rounded-full bg-white px-2 py-0.5 text-[10px] font-medium text-amber-700 border border-amber-200">
                  Day {replayState.currentBarIdx}/{replayState.futureBars.length}
                </span>
                {!replayState.settled && (
                  <div className="flex items-center gap-1">
                    {[1,2,5].map(s => (
                      <button key={s} onClick={()=>setReplayState(p=>p?{...p,speed:s}:p)}
                        className={clsx("rounded px-2 py-0.5 text-[10px] font-medium",
                          replayState.speed===s?"bg-amber-600 text-white":"bg-white border border-amber-300 text-amber-700")}
                      >{s}x</button>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {/* progress bar */}
            <div className="mb-3 h-1.5 overflow-hidden rounded-full bg-amber-100">
              <div className="h-full bg-amber-500 transition-all duration-500" style={{width: `${(replayState.currentBarIdx/Math.max(1,replayState.futureBars.length))*100}%`}} />
            </div>
            {/* settled result */}
            {replayState.settled && replayState.outcome && (
              <>
                <div className={clsx(
                  "rounded-lg p-3 text-center mb-3",
                  replayState.outcome === "tp_hit" ? "bg-emerald-100/70 border border-emerald-300" :
                  replayState.outcome === "sl_hit" ? "bg-red-100/70 border border-red-300" :
                  "bg-gray-100/70 border border-gray-300"
                )}>
                  <div className="text-2xl font-black mb-1">
                    {replayState.outcome === "tp_hit" && <span className="text-emerald-700">✓ 命中止盈 TP</span>}
                    {replayState.outcome === "sl_hit" && <span className="text-red-700">✗ 触发止损 SL</span>}
                    {replayState.outcome === "timeout" && <span className="text-gray-700">— 5日中性</span>}
                    {replayState.outcome === "no_trade" && <span className="text-gray-700">— 未开仓</span>}
                  </div>
                  <div className="grid grid-cols-3 gap-3 text-center text-[12px]">
                    <div><p className="text-gray-500 text-[10px]">出场价</p><p className="font-mono font-bold">{replayState.exitPrice?.toFixed(2)}</p></div>
                    <div><p className="text-gray-500 text-[10px]">盈亏/股</p><p className={clsx("font-mono font-bold", (replayState.pnlPerShare??0)>=0?"text-emerald-700":"text-red-700")}>{(replayState.pnlPerShare??0)>=0?"+":""}{replayState.pnlPerShare?.toFixed(2)} ({((replayState.pnlPct??0)*100).toFixed(2)}%)</p></div>
                    <div><p className="text-gray-500 text-[10px]">持仓天数</p><p className="font-mono font-bold">{replayState.futureBars.length}天</p></div>
                  </div>
                </div>
                {/* weight changes */}
                {weightChanges.length > 0 && (
                  <div>
                    <p className="text-[11px] font-semibold text-amber-900 mb-1.5">📊 大师权重更新（学习反馈）</p>
                    <div className="space-y-1">
                      {weightChanges.map(wc => {
                        const mc = MASTER_CONFIG[wc.masterId];
                        return (
                          <div key={wc.masterId} className="flex items-center gap-2 rounded bg-white/70 px-2 py-1.5">
                            <span className="h-2 w-2 rounded-full shrink-0" style={{backgroundColor: mc?.color ?? "#999"}} />
                            <span className="text-[11px] font-medium text-gray-900 shrink-0">{mc?.name ?? wc.masterId}</span>
                            <span className={clsx("text-[11px] font-mono font-bold ml-auto", wc.correct?"text-emerald-600":"text-red-600")}>
                              {wc.delta >= 0 ? "+" : ""}{wc.delta.toFixed(2)}
                            </span>
                            <span className="text-[10px] text-gray-400">→ {wc.newWeight.toFixed(2)}</span>
                            <span className={clsx("text-[10px] px-1.5 py-0.5 rounded", wc.correct?"bg-emerald-100 text-emerald-700":"bg-red-100 text-red-700")}>
                              {wc.correct?"预测正确":"预测错误"}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </>
            )}
          </div>
        )}

        {/* Verdict Hero - shown when done */}
        {verdict && (
          <div className={clsx(
            "mb-4 rounded-xl border-2 p-6 text-center shadow-lg",
            verdict.action === "buy" && "border-emerald-400 bg-gradient-to-b from-emerald-50/80 to-white shadow-emerald-100",
            verdict.action === "sell" && "border-red-400 bg-gradient-to-b from-red-50/80 to-white shadow-red-100",
            verdict.action === "hold" && "border-gray-300 bg-gradient-to-b from-gray-50/80 to-white shadow-gray-100",
          )}>
            <div className="mb-1 flex items-center justify-center gap-2">
              <Scale className={clsx("h-4 w-4", verdict.action === "buy" ? "text-emerald-600" : verdict.action === "sell" ? "text-red-600" : "text-gray-500")} />
              <span className="text-[10px] font-semibold uppercase tracking-widest text-gray-500">最终裁决 Final Verdict</span>
            </div>
            <div className={clsx(
              "text-5xl font-black tracking-tight mb-3",
              verdict.action === "buy" && "text-emerald-600",
              verdict.action === "sell" && "text-red-600",
              verdict.action === "hold" && "text-gray-500",
            )}>
              {verdict.action === "buy" && <>做多 <span className="inline-flex items-center gap-2"><TrendingUp className="h-10 w-10" />BUY</span></>}
              {verdict.action === "sell" && <>做空 <TrendingDown className="inline h-10 w-10" />SELL</>}
              {verdict.action === "hold" && <>观望 HOLD</>}
            </div>
            {verdict.action !== "hold" && verdict.quantity > 0 && (
              <div className="mx-auto grid max-w-xl grid-cols-4 gap-3 mb-3">
                {[
                  { label: "数量", value: `${verdict.quantity}股`, c: "text-gray-900" },
                  { label: "入场价", value: `HK$${fmtNum(verdict.price)}`, c: "text-blue-600" },
                  { label: "止损", value: verdict.stopLoss ? `HK$${fmtNum(verdict.stopLoss)}` : "--", c: "text-red-600" },
                  { label: "止盈", value: verdict.takeProfit ? `HK$${fmtNum(verdict.takeProfit)}` : "--", c: "text-emerald-600" },
                ].map(item => (
                  <div key={item.label} className="rounded-lg bg-white/80 border border-gray-200 p-2">
                    <div className="text-[9px] uppercase text-gray-400">{item.label}</div>
                    <div className={clsx("text-sm font-mono font-bold", item.c)}>{item.value}</div>
                  </div>
                ))}
              </div>
            )}
            <p className="mx-auto max-w-2xl text-xs leading-relaxed text-gray-600">{verdict.reasoning}</p>
            {/* Weighted score bar */}
            <div className="mx-auto mt-3 max-w-md">
              <div className="flex justify-between text-[10px] text-gray-400 mb-1">
                <span>BEAR -1</span>
                <span>加权得分: <span className="font-mono font-bold text-gray-700">{verdict.weightedScore.toFixed(2)}</span></span>
                <span>BULL +1</span>
              </div>
              <div className="relative h-2 rounded-full bg-gray-100 overflow-hidden">
                <div className="absolute inset-y-0 left-1/2 w-px bg-gray-300" />
                <div
                  className={clsx("absolute top-0 h-full rounded-full", verdict.weightedScore >= 0 ? "bg-emerald-500" : "bg-red-500")}
                  style={{
                    left: verdict.weightedScore >= 0 ? "50%" : `${50 + verdict.weightedScore * 50}%`,
                    width: `${Math.abs(verdict.weightedScore) * 50}%`,
                  }}
                />
              </div>
            </div>
          </div>
        )}

        {/* Three-column debate */}
        <div className="grid grid-cols-[1fr_300px_1fr] gap-4">
          {/* ── Left: Bull Side ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1">
              <div className="h-5 w-1 rounded-full bg-emerald-500" />
              <TrendingUp className="h-4 w-4 text-emerald-600" />
              <h3 className="text-sm font-bold text-emerald-700">多方观点 Bull Case</h3>
              <span className="ml-auto text-[10px] text-gray-400">{BULL_MASTERS.length} 位大师</span>
            </div>
            {BULL_MASTERS.map(mid => <MasterCard key={mid} mid={mid} />)}
          </div>

          {/* ── Center: Risk + Dalio ── */}
          <div className="space-y-3">
            {/* Risk check card */}
            <div className="rounded-lg border border-amber-200 bg-amber-50/50 shadow-sm overflow-hidden">
              <div className="flex items-center gap-2 bg-amber-50 px-3 py-2.5 border-b border-amber-100">
                <Shield className="h-4 w-4 text-amber-600" />
                <span className="text-sm font-semibold text-amber-800">风控审核</span>
                {risk && !risk.circuitBreakerActive && <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />}
                {risk?.circuitBreakerActive && <XCircle className="ml-auto h-4 w-4 text-red-500" />}
              </div>
              <div className="p-3 space-y-2 text-xs">
                {!risk && <div className="py-2 text-center text-gray-400"><Clock className="h-3 w-3 inline mr-1" />等待风控评估</div>}
                {risk && (
                  <>
                    <div className="flex justify-between"><span className="text-gray-500">仓位上限</span><span className="font-mono font-semibold text-gray-900">{(risk.positionLimitPct*100).toFixed(0)}%</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">最大股数</span><span className="font-mono font-semibold text-gray-900">{risk.maxBuyShares}股</span></div>
                    <div className="flex justify-between"><span className="text-gray-500">年化波动率</span><span className="font-mono font-semibold text-gray-900">{(risk.annualizedVolatility*100).toFixed(0)}%</span></div>
                    {risk.warnings?.map((w, i) => (
                      <div key={i} className="flex items-start gap-1 rounded bg-amber-100/60 px-2 py-1 text-amber-700">
                        <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0" />
                        <span>{w}</span>
                      </div>
                    ))}
                    {!risk.circuitBreakerActive && !risk.warnings?.length && (
                      <div className="rounded bg-emerald-50 px-2 py-1.5 text-emerald-700 text-center font-medium">
                        ✓ 风控通过
                      </div>
                    )}
                  </>
                )}
              </div>
            </div>

            {/* Trader Equation result card */}
            {traderEq && (
              <div className={clsx("rounded-lg border p-3 shadow-sm", traderEq.passed ? "border-emerald-200 bg-emerald-50/30" : "border-red-200 bg-red-50/30")}>
                <div className="flex items-center gap-2 mb-2">
                  <span className={clsx("rounded px-1.5 py-0.5 text-[10px] font-bold text-white", traderEq.passed ? "bg-emerald-600" : "bg-red-600")}>
                    {traderEq.passed ? "✓ 交易者方程通过" : "✗ 交易者方程未通过"}
                  </span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="rounded bg-white/60 py-1.5">
                    <p className="text-[10px] text-gray-500">盈亏比 R:R</p>
                    <p className="text-sm font-mono font-bold text-gray-900">{traderEq.rr.toFixed(2)}:1</p>
                    <p className="text-[9px] text-gray-400">需 ≥ 1.5:1</p>
                  </div>
                  <div className="rounded bg-white/60 py-1.5">
                    <p className="text-[10px] text-gray-500">预估胜率</p>
                    <p className="text-sm font-mono font-bold text-gray-900">{(traderEq.winRate * 100).toFixed(0)}%</p>
                    <p className="text-[9px] text-gray-400">基于场景+ADX估算</p>
                  </div>
                  <div className="rounded bg-white/60 py-1.5">
                    <p className="text-[10px] text-gray-500">期望值 EV</p>
                    <p className={clsx("text-sm font-mono font-bold", traderEq.ev > 0 ? "text-emerald-700" : "text-red-700")}>{traderEq.ev.toFixed(2)}</p>
                    <p className="text-[9px] text-gray-400">每承担1元风险收益</p>
                  </div>
                </div>
                <p className="mt-2 text-[11px] leading-relaxed text-gray-700">{traderEq.reason}</p>
                {traderEq.suggestion && <p className="mt-1 text-[11px] text-amber-700 rounded bg-amber-50 px-2 py-1">💡 {traderEq.suggestion}</p>}
              </div>
            )}

            {/* Dalio (center) */}
            {CENTER_MASTERS.map(mid => <MasterCard key={mid} mid={mid} />)}

            {/* Order executed */}
            {orderInfo && (
              <div className="rounded-lg border border-blue-200 bg-blue-50/50 p-3 shadow-sm">
                <div className="flex items-center gap-2 mb-2">
                  <Wallet className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-semibold text-blue-800">模拟订单</span>
                  <CheckCircle2 className="ml-auto h-4 w-4 text-emerald-500" />
                </div>
                <div className="space-y-1 text-xs font-mono">
                  <div className="flex justify-between"><span className="text-gray-500">方向</span><span className="font-bold text-blue-700 uppercase">{orderInfo.action}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">数量</span><span className="font-bold text-gray-900">{orderInfo.quantity}股</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">价格</span><span className="font-bold text-gray-900">HK${fmtNum(orderInfo.price)}</span></div>
                  <div className="flex justify-between"><span className="text-gray-500">金额</span><span className="font-bold text-gray-900">HK${fmtNum(orderInfo.price * orderInfo.quantity, 0)}</span></div>
                </div>
              </div>
            )}
          </div>

          {/* ── Right: Bear Side ── */}
          <div className="space-y-3">
            <div className="flex items-center gap-2 pb-1">
              <div className="h-5 w-1 rounded-full bg-red-500" />
              <TrendingDown className="h-4 w-4 text-red-600" />
              <h3 className="text-sm font-bold text-red-700">空方观点 Bear Case</h3>
              <span className="ml-auto text-[10px] text-gray-400">{BEAR_MASTERS.length} 位大师</span>
            </div>
            {BEAR_MASTERS.map(mid => <MasterCard key={mid} mid={mid} />)}
          </div>
        </div>

        {/* Empty state - when no analysis */}
        {!quote && !running && (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="mb-4 rounded-full bg-blue-50 p-4">
              <Brain className="h-10 w-10 text-blue-500" />
            </div>
            <h3 className="text-lg font-semibold text-gray-900 mb-1">选择股票开始分析</h3>
            <p className="text-sm text-gray-500 max-w-md">选择港股代码，输入投资想法，五位投资大师将独立分析并给出裁决</p>
          </div>
        )}

        {/* Spacer */}
        <div className="h-20" />
      </div>

      {/* ── Bottom Output Panel ── */}
      {outputOpen && (
        <div className="shrink-0 border-t border-gray-200 bg-white">
          {/* Tab bar */}
          <div className="flex items-center border-b border-gray-100 px-4">
            {([
              { id: "progress", label: "执行日志", icon: Activity },
              { id: "summary", label: "裁决摘要", icon: BarChart3 },
              { id: "analysis", label: "详细分析", icon: Sparkles },
            ] as const).map(tab => (
              <button
                key={tab.id}
                onClick={() => setOutputTab(tab.id)}
                className={clsx(
                  "flex items-center gap-1 border-b-2 px-3 py-2 text-xs font-medium transition-colors -mb-px",
                  outputTab === tab.id ? "border-blue-500 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
                )}
              >
                <tab.icon className="h-3 w-3" />
                {tab.label}
              </button>
            ))}
            <button onClick={() => setOutputOpen(false)} className="ml-auto text-gray-400 hover:text-gray-600 p-1">
              <Square className="h-3 w-3" />
            </button>
          </div>
          <div className="max-h-48 overflow-auto p-3 text-xs">
            {outputTab === "progress" && (
              <div className="space-y-1">
                {progressSteps.map((step, i) => (
                  <div key={i} className="flex items-center gap-2">
                    {step.status === "done" && <CheckCircle2 className="h-3 w-3 text-emerald-500 shrink-0" />}
                    {step.status === "running" && <RefreshCw className="h-3 w-3 text-blue-500 animate-spin shrink-0" />}
                    {step.status === "error" && <XCircle className="h-3 w-3 text-red-500 shrink-0" />}
                    {step.status === "waiting" && <Clock className="h-3 w-3 text-gray-400 shrink-0" />}
                    <span className={clsx(step.status === "error" ? "text-red-600" : "text-gray-700")}>{step.label}</span>
                    {step.time && <span className="ml-auto text-gray-400 font-mono text-[10px]">{step.time}</span>}
                  </div>
                ))}
              </div>
            )}
            {outputTab === "summary" && verdict && (
              <div className="overflow-x-auto">
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-200 text-gray-500">
                      <th className="py-1.5 text-left font-medium">代码</th>
                      <th className="py-1.5 text-left font-medium">动作</th>
                      <th className="py-1.5 text-right font-medium">数量</th>
                      <th className="py-1.5 text-right font-medium">价格</th>
                      <th className="py-1.5 text-right font-medium">置信度</th>
                      <th className="py-1.5 text-right font-medium">止损</th>
                      <th className="py-1.5 text-right font-medium">止盈</th>
                    </tr>
                  </thead>
                  <tbody>
                    <tr className="border-b border-gray-100">
                      <td className="py-1.5 font-mono font-semibold">{symbol}</td>
                      <td className="py-1.5">
                        <span className={clsx(
                          "inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-bold",
                          verdict.action === "buy" && "bg-emerald-100 text-emerald-700",
                          verdict.action === "sell" && "bg-red-100 text-red-700",
                          verdict.action === "hold" && "bg-gray-100 text-gray-600",
                        )}>
                          {verdict.action === "buy" && <TrendingUp className="h-2.5 w-2.5" />}
                          {verdict.action === "sell" && <TrendingDown className="h-2.5 w-2.5" />}
                          {verdict.verdict}
                        </span>
                      </td>
                      <td className="py-1.5 text-right font-mono">{verdict.quantity > 0 ? verdict.quantity : "--"}</td>
                      <td className="py-1.5 text-right font-mono">{fmtNum(verdict.price)}</td>
                      <td className="py-1.5 text-right font-mono">{Math.round(Math.abs(verdict.weightedScore) * 100)}%</td>
                      <td className="py-1.5 text-right font-mono text-red-600">{verdict.stopLoss ? fmtNum(verdict.stopLoss) : "--"}</td>
                      <td className="py-1.5 text-right font-mono text-emerald-600">{verdict.takeProfit ? fmtNum(verdict.takeProfit) : "--"}</td>
                    </tr>
                  </tbody>
                </table>
              </div>
            )}
            {outputTab === "analysis" && (
              <div className="space-y-2">
                {Object.entries(signals).map(([mid, sig]) => (
                  <div key={mid} className="rounded border border-gray-100 p-2">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={clsx(
                        "inline-flex h-5 w-5 items-center justify-center rounded text-[10px] font-bold text-white",
                        MASTER_CONFIG[mid]?.bgClass?.includes("emerald") && "bg-emerald-500",
                        MASTER_CONFIG[mid]?.bgClass?.includes("sky") && "bg-sky-500",
                        MASTER_CONFIG[mid]?.bgClass?.includes("red") && "bg-red-500",
                        MASTER_CONFIG[mid]?.bgClass?.includes("orange") && "bg-orange-500",
                        MASTER_CONFIG[mid]?.bgClass?.includes("amber") && "bg-amber-500",
                      )}>{MASTER_CONFIG[mid]?.icon}</span>
                      <span className="font-semibold text-gray-900">{MASTER_CONFIG[mid]?.name ?? mid}</span>
                      <span className={clsx(
                        "rounded px-1.5 py-0.5 text-[10px] font-bold",
                        sig.direction === "bullish" && "bg-emerald-100 text-emerald-700",
                        sig.direction === "bearish" && "bg-red-100 text-red-700",
                        sig.direction === "neutral" && "bg-gray-100 text-gray-600",
                      )}>{sig.direction.toUpperCase()} {Math.round(sig.confidence)}%</span>
                    </div>
                    <p className="text-gray-600 leading-relaxed">{sig.thesis}</p>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Free Chat (Ask the Desk) ── */}
      {(caseId || chatOpen) && (
        <div className="shrink-0 border-t border-gray-200 bg-white">
          <div className="flex items-center justify-between border-b border-gray-100 px-4 py-2">
            <h4 className="text-[12px] font-semibold text-gray-900">💬 追问大师（Ask the Desk）</h4>
            <button onClick={() => setChatOpen(!chatOpen)} className="text-[11px] text-blue-600">{chatOpen ? "收起" : "展开"}</button>
          </div>
          {chatOpen && (
            <div className="p-3">
              <div className="max-h-40 space-y-2 overflow-y-auto mb-2">
                {chatMessages.length === 0 && <p className="text-[11px] text-gray-400">分析完成后可以继续追问，例如："如果明天跌破止损怎么办？"</p>}
                {chatMessages.map((m, i) => (
                  <div key={i} className={clsx("rounded-lg px-2.5 py-1.5 text-[12px]", m.role === "user" ? "bg-blue-50 text-blue-900 ml-8" : "bg-gray-50 text-gray-800 mr-8")}>
                    {m.content}
                  </div>
                ))}
              </div>
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!chatInput.trim()) return;
                  const userMsg = chatInput;
                  setChatMessages(ms => [...ms, { role: "user", content: userMsg }]);
                  setChatInput("");
                  setTimeout(() => {
                    setChatMessages(ms => [...ms, { role: "assistant", content: `基于本次分析，${userMsg} 建议：严格执行止损纪律，若入场后2日未朝预期方向运行则考虑减仓。` }]);
                  }, 800);
                }}
                className="flex gap-2"
              >
                <input
                  value={chatInput}
                  onChange={e => setChatInput(e.target.value)}
                  placeholder="输入追问，例如：如果明天跌破止损怎么办？"
                  className="flex-1 rounded-md border border-gray-300 px-3 py-1.5 text-[12px] focus:border-blue-500 focus:outline-none"
                />
                <button type="submit" className="rounded-md bg-blue-50/80 border border-blue-200 text-blue-700 hover:bg-blue-100 px-3 py-1.5 text-[12px] font-medium transition-colors">发送</button>
              </form>
              <p className="mt-1 text-[10px] text-gray-400">※ 当前为mock回复，后续接入LLM上下文对话</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
