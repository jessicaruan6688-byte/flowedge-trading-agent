/**
 * flowEdge — 纯代码风险引擎（港股）
 *
 * 基于 AI Hedge Fund risk manager 思路，针对港股波动特性做了参数调校。
 * 所有计算都是确定性的、无 LLM、可测试的纯函数。
 */

import type {
  Portfolio,
  Position,
  TechnicalIndicators,
  RiskAssessment,
  AllowedActions,
  TradeAction,
} from "@/lib/types";

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

export const INITIAL_BALANCE = Number(process.env.INITIAL_PAPER_BALANCE || "1000000"); // HKD
export const BASE_POSITION_LIMIT_PCT = 0.12;           // 单标的基准 12%（港股波动更大，低于美股 20%）
export const MAX_PORTFOLIO_DRAWDOWN_PCT = 0.15;        // 组合最大回撤熔断 15%
export const SINGLE_STOCK_STOP_LOSS_PCT = 0.08;        // 单笔硬止损 8%
export const VOLATILITY_LOOKBACK = 20;
export const EXTREME_DAILY_VOL_PCT = 0.05;             // 日波动 > 5% 视为极端
export const HIGH_ATR_PCT = 0.03;                      // ATR/价格 > 3% 高风险
export const RSI_OVERBOUGHT = 85;
export const RSI_OVERSOLD = 15;
export const LOW_VOLUME_RATIO = 0.8;
export const MAX_STOP_DISTANCE_PCT = 0.10;             // 止损距离不超过入场价 10%

// 港股"一手"通常是 100 股（少数 ETF/高价股例外，MVP 先统一 100）
const LOT_SIZE = 100;

// ---------------------------------------------------------------------------
// 工具
// ---------------------------------------------------------------------------

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

function roundToLot(shares: number): number {
  if (shares <= 0) return 0;
  return Math.floor(shares / LOT_SIZE) * LOT_SIZE;
}

function portfolioValueOf(portfolio: Portfolio, currentPrices?: Record<string, number>): number {
  const posValue = portfolio.positions.reduce((sum, p) => {
    const price = currentPrices?.[p.symbol] ?? p.currentPrice;
    return sum + price * p.quantity;
  }, 0);
  return portfolio.cash + posValue;
}

// ---------------------------------------------------------------------------
// 波动率调仓乘数（针对港股调校）
// ---------------------------------------------------------------------------

/**
 * 根据年化波动率返回仓位乘数，并钳位到 [4%, 15%] 对应百分比。
 * 区间：
 *   annVol <  20% : multiplier = 1.25              → ~15% max
 *   20%~35%       : 1.0 - (v-0.20)*0.67 (线性)     → 15% → ~5%
 *   35%~55%       : 0.55 - (v-0.35)*0.75 (线性)    → ~7% → ~3%（clamp 到 4%）
 *   > 55%         : 0.4                            → ~5%（clamp 到 4%）
 */
export function volatilityMultiplier(annualizedVolatility: number): number {
  const v = clamp(annualizedVolatility, 0, 2);
  let mult: number;
  if (v < 0.20) {
    mult = 1.25;
  } else if (v < 0.35) {
    mult = 1.0 - (v - 0.20) * 0.67;
  } else if (v < 0.55) {
    mult = 0.55 - (v - 0.35) * 0.75;
  } else {
    mult = 0.4;
  }
  const pct = BASE_POSITION_LIMIT_PCT * mult;
  const clamped = clamp(pct, 0.04, 0.15);
  return clamped / BASE_POSITION_LIMIT_PCT;
}

// ---------------------------------------------------------------------------
// assessRisk
// ---------------------------------------------------------------------------

export function assessRisk(params: {
  portfolio: Portfolio;
  currentPrice: number;
  annualizedVolatility: number;
  dailyVolatility: number;
  existingPositions?: Position[];
  symbol: string;
}): RiskAssessment {
  const {
    portfolio,
    currentPrice,
    annualizedVolatility,
    dailyVolatility,
    existingPositions,
    symbol,
  } = params;

  if (!(currentPrice > 0)) {
    throw new Error(`assessRisk: invalid currentPrice ${currentPrice}`);
  }

  const warnings: string[] = [];

  // 组合总权益
  const portValue = portfolioValueOf(portfolio);

  // 当前对该 symbol 的持仓市值
  const positions = existingPositions ?? portfolio.positions;
  const existing = positions.find((p) => p.symbol === symbol);
  const existingQty = existing?.quantity ?? 0;
  const existingValue = existingQty * currentPrice;

  // 波动率调仓
  const volMult = volatilityMultiplier(annualizedVolatility);
  const adjustedLimitPct = clamp(BASE_POSITION_LIMIT_PCT * volMult, 0.04, 0.15);
  const positionLimit = portValue * adjustedLimitPct; // HKD
  const remainingCapacity = Math.max(0, positionLimit - existingValue);

  // 可用现金也约束买入
  const affordableByCash = Math.max(0, portfolio.cash);
  const maxNotional = Math.min(remainingCapacity, affordableByCash);
  const maxSharesRaw = maxNotional / currentPrice;
  const maxShares = roundToLot(maxSharesRaw);

  // 熔断：组合回撤
  const drawdown =
    portfolio.initialBalance > 0
      ? (portfolio.initialBalance - portValue) / portfolio.initialBalance
      : 0;
  let circuitBreakerActive = false;
  let circuitBreakerReason: string | undefined;
  if (drawdown > MAX_PORTFOLIO_DRAWDOWN_PCT) {
    circuitBreakerActive = true;
    circuitBreakerReason = `组合回撤 ${(drawdown * 100).toFixed(2)}% 超过阈值 ${(MAX_PORTFOLIO_DRAWDOWN_PCT * 100).toFixed(0)}%，触发熔断`;
  }

  // 日波动极端警告
  if (dailyVolatility > EXTREME_DAILY_VOL_PCT) {
    warnings.push(`日波动率 ${(dailyVolatility * 100).toFixed(2)}% 超过 ${(EXTREME_DAILY_VOL_PCT * 100).toFixed(0)}%，建议减仓`);
  }

  return {
    volatility: annualizedVolatility,
    dailyVolatility,
    maxDrawdownAllowance: MAX_PORTFOLIO_DRAWDOWN_PCT,
    positionLimit,
    positionLimitPct: adjustedLimitPct,
    volatilityMultiplier: volMult,
    circuitBreakerActive,
    circuitBreakerReason,
    portfolioValue: portValue,
    existingPositionValue: existingValue,
    remainingCapacity,
    maxBuyShares: circuitBreakerActive ? 0 : maxShares,
    rsi: undefined,
    volumeRatio: undefined,
    warnings,
    reasoning: {
      symbol,
      currentPrice,
      portfolioValue: portValue,
      annualizedVolatility,
      dailyVolatility,
      volMultiplier: volMult,
      basePositionLimitPct: BASE_POSITION_LIMIT_PCT,
      adjustedPositionLimitPct: adjustedLimitPct,
      positionLimitHKD: positionLimit,
      existingQty,
      existingValueHKD: existingValue,
      remainingCapacityHKD: remainingCapacity,
      availableCash: portfolio.cash,
      maxNotionalHKD: maxNotional,
      maxSharesRaw,
      maxSharesLot: maxShares,
      drawdownPct: drawdown,
      circuitBreakerActive,
      warningsCount: warnings.length,
    },
  };
}

// ---------------------------------------------------------------------------
// checkCircuitBreakers
// ---------------------------------------------------------------------------

export function checkCircuitBreakers(params: {
  portfolio: Portfolio;
  technicals: TechnicalIndicators;
  currentPrice: number;
}): { triggered: boolean; reason?: string; warnings: string[] } {
  const { portfolio, technicals, currentPrice } = params;
  const warnings: string[] = [];

  const portValue = portfolioValueOf(portfolio);
  const drawdown =
    portfolio.initialBalance > 0
      ? (portfolio.initialBalance - portValue) / portfolio.initialBalance
      : 0;

  // 硬熔断：组合回撤
  if (drawdown > MAX_PORTFOLIO_DRAWDOWN_PCT) {
    return {
      triggered: true,
      reason: `组合最大回撤熔断：当前回撤 ${(drawdown * 100).toFixed(2)}% > ${(MAX_PORTFOLIO_DRAWDOWN_PCT * 100).toFixed(0)}% 阈值`,
      warnings,
    };
  }

  // 警告：RSI 超买 + 缩量
  const rsi = technicals.rsi;
  const volRatio = technicals.volumeRatio ?? (technicals.volume && technicals.avgVolume
    ? technicals.volume / technicals.avgVolume
    : undefined);
  if (typeof rsi === "number") {
    if (rsi > RSI_OVERBOUGHT && typeof volRatio === "number" && volRatio < LOW_VOLUME_RATIO) {
      warnings.push(`RSI=${rsi.toFixed(1)} 超买且量比=${volRatio.toFixed(2)}<0.8，量价背离（仅警告，不熔断）`);
    }
    if (rsi < RSI_OVERSOLD && typeof volRatio === "number" && volRatio < LOW_VOLUME_RATIO) {
      warnings.push(`RSI=${rsi.toFixed(1)} 超卖且量比=${volRatio.toFixed(2)}<0.8，可能恐慌抛售（仅警告）`);
    }
  }

  // 警告：日波动极端
  const dailyVol = technicals.dailyVolatility;
  if (typeof dailyVol === "number" && dailyVol > EXTREME_DAILY_VOL_PCT) {
    warnings.push(`日波动率 ${(dailyVol * 100).toFixed(2)}% > ${(EXTREME_DAILY_VOL_PCT * 100).toFixed(0)}%，建议缩小仓位`);
  }

  // 警告：ATR/价格过高
  if (currentPrice > 0) {
    const atrPct = technicals.atrPct ?? (technicals.atr ? technicals.atr / currentPrice : undefined);
    if (typeof atrPct === "number" && atrPct > HIGH_ATR_PCT) {
      warnings.push(`ATR/价格 = ${(atrPct * 100).toFixed(2)}% > ${(HIGH_ATR_PCT * 100).toFixed(0)}%，高风险`);
    }
  }

  return { triggered: false, warnings };
}

// ---------------------------------------------------------------------------
// computeAllowedActions
// ---------------------------------------------------------------------------

export function computeAllowedActions(params: {
  riskAssessment: RiskAssessment;
  portfolio: Portfolio;
  currentPrice: number;
  symbol: string;
}): AllowedActions {
  const { riskAssessment, portfolio, currentPrice, symbol } = params;
  const warnings = [...riskAssessment.warnings];

  // 技术指标熔断检查（如果传入 rsi/atr 就再查一次）
  // 这里不重复调用 checkCircuitBreakers（因为 technicals 未必可用），
  // 由 assessRisk 已写入的 warning 为准。

  const existing = portfolio.positions.find((p) => p.symbol === symbol);
  const existingQty = existing?.quantity ?? 0;

  if (riskAssessment.circuitBreakerActive) {
    return {
      canBuy: false,
      canSell: existingQty > 0,
      maxBuyShares: 0,
      maxSellShares: existingQty,
      recommendedSizePct: 0,
      reason: riskAssessment.circuitBreakerReason ?? "风控熔断已触发，禁止开新仓",
      warnings,
    };
  }

  const maxBuy = riskAssessment.maxBuyShares;
  const canBuy = maxBuy > 0 && portfolio.cash >= currentPrice * LOT_SIZE;

  return {
    canBuy,
    canSell: existingQty > 0,
    maxBuyShares: maxBuy,
    maxSellShares: existingQty,
    recommendedSizePct: riskAssessment.positionLimitPct,
    reason: canBuy
      ? `允许买入，最大仓位 ${(riskAssessment.positionLimitPct * 100).toFixed(1)}% (${maxBuy} 股)`
      : existingQty > 0
        ? "现金/仓位限制无法加仓，可卖出"
        : "无操作空间",
    warnings,
  };
}

// ---------------------------------------------------------------------------
// calculateRiskLevels — ATR 倍数止损止盈
// ---------------------------------------------------------------------------

export function calculateRiskLevels(params: {
  entryPrice: number;
  atr: number;
  direction: "long" | "short";
  riskMultiple?: number;
}): { stopLoss: number; takeProfit: number } {
  const { entryPrice, atr, direction } = params;
  const riskMultiple = params.riskMultiple ?? 2;
  if (!(entryPrice > 0) || !(atr >= 0)) {
    throw new Error(`calculateRiskLevels: invalid inputs entry=${entryPrice} atr=${atr}`);
  }

  const maxStopDistance = entryPrice * MAX_STOP_DISTANCE_PCT;
  const rawStopDistance = riskMultiple * atr;
  const stopDistance = Math.min(rawStopDistance, maxStopDistance);
  const takeDistance = riskMultiple * 2 * atr; // 2:1 盈亏比

  let stopLoss: number;
  let takeProfit: number;
  if (direction === "long") {
    stopLoss = Math.max(0.0001, entryPrice - stopDistance);
    takeProfit = entryPrice + takeDistance;
  } else {
    stopLoss = entryPrice + stopDistance;
    takeProfit = Math.max(0.0001, entryPrice - takeDistance);
  }

  return { stopLoss, takeProfit };
}

// ---------------------------------------------------------------------------
// kellyPositionSize — 分数凯利（1/4 Kelly 保守版）
// ---------------------------------------------------------------------------

/**
 * 简化分数凯利仓位：
 *   kelly = (p*b - q) / b，其中 p=胜率, q=1-p, b=赢亏比(avgWinPct/avgLossPct)
 *   实际使用 kelly / 4（quarter-Kelly）做安全垫。
 * 返回建议买入股数（已按 100 股一手向下取整）。
 */
export function kellyPositionSize(params: {
  winRate: number;
  avgWinPct: number;
  avgLossPct: number;
  portfolioValue: number;
  price: number;
}): number {
  const { winRate, avgWinPct, avgLossPct, portfolioValue, price } = params;
  if (!(price > 0) || !(portfolioValue > 0)) return 0;
  const p = clamp(winRate, 0, 1);
  const q = 1 - p;
  if (!(avgWinPct > 0) || !(avgLossPct > 0)) return 0;
  const b = avgWinPct / avgLossPct;
  let kelly = (p * b - q) / b;
  kelly = clamp(kelly, 0, 0.25); // 单票上限 25%（再叠加风控二次过滤）
  const quarterKelly = kelly / 4;
  const notional = portfolioValue * quarterKelly;
  return roundToLot(notional / price);
}

// ---------------------------------------------------------------------------
// 默认止损（备用，无 ATR 时使用固定百分比）
// ---------------------------------------------------------------------------

export function defaultStopPrice(entryPrice: number, direction: "long" | "short" = "long"): number {
  const d = entryPrice * SINGLE_STOCK_STOP_LOSS_PCT;
  return direction === "long" ? entryPrice - d : entryPrice + d;
}

// 让类型检查器确认 TradeAction 被使用（避免 unused 警告）
export type { TradeAction };
