/**
 * 闸门诊断模块（Gate Engine）
 *
 * 参考 PA_Agent 的两阶段分析思想，简化为 4 步顺序闸门的纯函数实现。
 * 任何一步 no 则短路，返回最终 verdict。
 *
 * 全部为纯函数：不做 API 调用、不做 IO、不引入外部副作用。
 */

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export type GateVerdict = "proceed" | "wait" | "reject";

export interface GateNode {
  id: string; // "g1_data" | "g2_cycle" | "g3_climax" | "g4_risk"
  question: string;
  answer: "yes" | "no";
  result: GateVerdict;
  reason: string;
}

export type MarketRegime =
  | "trend_up"
  | "trend_down"
  | "range"
  | "spike_up"
  | "spike_down"
  | "unknown";

export interface GateDiagnosis {
  verdict: GateVerdict;
  nodes: GateNode[];
  marketRegime: MarketRegime;
  direction: "bullish" | "bearish" | "neutral";
  climaxRisk: "none" | "warning" | "triggered";
  emaState: {
    ema8: number;
    ema21: number;
    ema55: number;
    priceVsEma21: "above" | "below";
    ema21Slope: "up" | "down" | "flat";
  };
  gateRejectReason?: string;
}

export interface GateBar {
  close: number;
  high: number;
  low: number;
  open: number;
  volume: number;
  ma5?: number;
  ma20?: number;
  ma60?: number;
}

export interface GateTechnicals {
  rsi?: number;
  ema8?: number;
  ema21?: number;
  ema55?: number;
  macd?: number;
  atr?: number;
  adx14?: number;
  volumeRatio?: number;
  volatility20d?: number;
  bollingerUpper?: number;
  bollingerLower?: number;
}

export interface GatePosition {
  symbol: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
}

export interface GatePortfolio {
  cash: number;
  totalValue: number;
  positions: GatePosition[];
  dailyPnl: number;
  maxDrawdown: number;
}

export interface GateInput {
  bars: GateBar[];
  technicals: GateTechnicals;
  portfolio: GatePortfolio;
  currentPrice: number;
  /** 当前要判断的标的；未传时仅做组合层面检查，不做单票集中度检查 */
  symbol?: string;
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

const MIN_BARS = 60;
const EMA_SLOPE_LOOKBACK = 5;
const SPike_BREAKOUT_LOOKBACK = 3;
const ADX_STRONG_TREND = 30;
const ADX_RANGE = 20;

const RSI_CLIMAX_OVERBOUGHT = 78;
const RSI_CLIMAX_OVERSOLD = 22;
const RSI_WARNING_OVERBOUGHT = 72;
const RSI_WARNING_OVERSOLD = 28;

const MAX_PORTFOLIO_DRAWDOWN_PCT = 0.15;
const SINGLE_POSITION_CONCENTRATION_PCT = 0.30;

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

/** 计算一个数组的斜率（连续递增/递减/走平） */
function slopeOf(values: number[]): "up" | "down" | "flat" {
  if (values.length < 2) return "flat";
  let inc = 0;
  let dec = 0;
  for (let i = 1; i < values.length; i++) {
    const d = values[i] - values[i - 1];
    if (d > 0) inc++;
    else if (d < 0) dec++;
  }
  if (inc >= dec && inc > 0) return "up";
  if (dec > inc && dec > 0) return "down";
  return "flat";
}

/** 从 bars 的 close 估算 ema21 斜率（当 technicals.ema21 有传但只有单值时用）。
 *  此处为黑客松简化版本：若外部没有传入 EMA 序列，则用 ma20 近似、或基于 close 做 EMA 递推。 */
function computeEmaSeries(closes: number[], period: number): number[] {
  if (closes.length === 0) return [];
  const k = 2 / (period + 1);
  const out: number[] = [closes[0]];
  for (let i = 1; i < closes.length; i++) {
    out.push(closes[i] * k + out[i - 1] * (1 - k));
  }
  return out;
}

function last<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr.slice();
  return arr.slice(arr.length - n);
}

// ---------------------------------------------------------------------------
// G1：数据充足
// ---------------------------------------------------------------------------

function checkG1(bars: GateBar[]): { ok: boolean; reason: string } {
  const len = bars?.length ?? 0;
  if (len >= MIN_BARS) {
    return { ok: true, reason: `K线数量${len}根，数据充足（≥${MIN_BARS}）` };
  }
  return { ok: false, reason: `K线数量仅${len}根，不足${MIN_BARS}根，无法可靠判断` };
}

// ---------------------------------------------------------------------------
// G2：市场周期可识别
// ---------------------------------------------------------------------------

function checkG2(
  bars: GateBar[],
  technicals: GateTechnicals,
  currentPrice: number,
): {
  ok: boolean;
  reason: string;
  regime: MarketRegime;
  ema8: number;
  ema21: number;
  ema55: number;
  ema21Slope: "up" | "down" | "flat";
  priceVsEma21: "above" | "below";
} {
  const closes = bars.map((b) => b.close).filter(isNumber);

  // 优先使用外部传入的 EMA 值；缺失则用 close 估算
  let ema8 = technicals.ema8;
  let ema21 = technicals.ema21;
  let ema55 = technicals.ema55;

  const hasExternalEmas = isNumber(ema8) && isNumber(ema21) && isNumber(ema55);

  if (!isNumber(ema8) && closes.length >= 8) {
    const s = computeEmaSeries(closes, 8);
    ema8 = s[s.length - 1];
  }
  if (!isNumber(ema21) && closes.length >= 21) {
    const s = computeEmaSeries(closes, 21);
    ema21 = s[s.length - 1];
  }
  if (!isNumber(ema55) && closes.length >= 55) {
    const s = computeEmaSeries(closes, 55);
    ema55 = s[s.length - 1];
  }

  // EMA 不完整 -> 无法识别
  if (!isNumber(ema8) || !isNumber(ema21) || !isNumber(ema55)) {
    return {
      ok: false,
      reason: `EMA 数据不完整（ema8=${ema8}, ema21=${ema21}, ema55=${ema55}），市场周期无法识别`,
      regime: "unknown",
      ema8: ema8 ?? NaN,
      ema21: ema21 ?? NaN,
      ema55: ema55 ?? NaN,
      ema21Slope: "flat",
      priceVsEma21: currentPrice >= (ema21 ?? 0) ? "above" : "below",
    };
  }

  // 判断 EMA21 斜率：若外部没传序列，则用自算 ema21 序列的尾部
  let ema21Slope: "up" | "down" | "flat" = "flat";
  if (hasExternalEmas) {
    // 外部仅给了瞬时值，用 bars 计算的 EMA21 序列反推斜率（更可靠）
    const s = computeEmaSeries(closes, 21);
    ema21Slope = slopeOf(last(s, EMA_SLOPE_LOOKBACK));
  } else {
    const s = computeEmaSeries(closes, 21);
    ema21Slope = slopeOf(last(s, EMA_SLOPE_LOOKBACK));
  }

  const adx = technicals.adx14;
  const bullishAlign = ema8 > ema21 && ema21 > ema55;
  const bearishAlign = ema8 < ema21 && ema21 < ema55;

  let regime: MarketRegime;
  let reason: string;
  let ok = true;

  if (bullishAlign && ema21Slope === "up") {
    regime = "trend_up";
    reason = `多头排列（ema8=${ema8.toFixed(2)} > ema21=${ema21.toFixed(2)} > ema55=${ema55.toFixed(2)}），ema21 斜率向上`;
  } else if (bearishAlign && ema21Slope === "down") {
    regime = "trend_down";
    reason = `空头排列（ema8=${ema8.toFixed(2)} < ema21=${ema21.toFixed(2)} < ema55=${ema55.toFixed(2)}），ema21 斜率向下`;
  } else {
    regime = "range";
    if (isNumber(adx) && adx < ADX_RANGE) {
      reason = `EMA 无明确排列，ADX=${adx.toFixed(1)}<${ADX_RANGE}，判定为震荡市`;
    } else {
      reason = "EMA 排列紊乱，未形成明确趋势，判定为震荡市";
    }
  }

  // 在 G2 之上细化 spike_* （需要至少 3 根 K 线判断连创新高/低）
  if (closes.length >= SPike_BREAKOUT_LOOKBACK) {
    const tail = last(closes, SPike_BREAKOUT_LOOKBACK);
    const higherHighs = tail.every((c, i) => i === 0 || c > tail[i - 1]);
    const lowerLows = tail.every((c, i) => i === 0 || c < tail[i - 1]);
    const strongTrend = isNumber(adx) && adx > ADX_STRONG_TREND;

    if (regime === "trend_up" && strongTrend && higherHighs) {
      regime = "spike_up";
      reason += `；ADX=${adx.toFixed(1)}>${ADX_STRONG_TREND} 且近${SPike_BREAKOUT_LOOKBACK}根连创新高，加速上行`;
    } else if (regime === "trend_down" && strongTrend && lowerLows) {
      regime = "spike_down";
      reason += `；ADX=${adx.toFixed(1)}>${ADX_STRONG_TREND} 且近${SPike_BREAKOUT_LOOKBACK}根连创新低，加速下行`;
    }
  }

  const priceVsEma21: "above" | "below" = currentPrice >= ema21 ? "above" : "below";

  return {
    ok,
    reason,
    regime,
    ema8,
    ema21,
    ema55,
    ema21Slope,
    priceVsEma21,
  };
}

// ---------------------------------------------------------------------------
// G3：高潮风险
// ---------------------------------------------------------------------------

function checkG3(
  technicals: GateTechnicals,
  currentPrice: number,
): {
  ok: boolean; // no -> reject（triggered）；yes -> proceed（可能含 warning）
  result: GateVerdict;
  climaxRisk: "none" | "warning" | "triggered";
  reason: string;
  directionalBias: "bullish" | "bearish" | "neutral";
} {
  const rsi = technicals.rsi;
  const bbUp = technicals.bollingerUpper;
  const bbLow = technicals.bollingerLower;

  let climaxRisk: "none" | "warning" | "triggered" = "none";
  let reason = "无高潮/恐慌迹象";
  let result: GateVerdict = "proceed";
  let directionalBias: "bullish" | "bearish" | "neutral" = "neutral";
  let ok = true;

  const priceAboveBB = isNumber(bbUp) && currentPrice > bbUp;
  const priceBelowBB = isNumber(bbLow) && currentPrice < bbLow;

  if (isNumber(rsi)) {
    if (rsi > RSI_CLIMAX_OVERBOUGHT && priceAboveBB) {
      climaxRisk = "triggered";
      ok = false;
      result = "reject";
      reason = `RSI=${rsi.toFixed(1)}>${RSI_CLIMAX_OVERBOUGHT} 且价格突破布林上轨(${bbUp?.toFixed(2)})，疑似追高高潮，禁止追多（SCS hard rule）`;
      directionalBias = "neutral";
    } else if (rsi < RSI_CLIMAX_OVERSOLD && priceBelowBB) {
      climaxRisk = "triggered";
      ok = false;
      result = "reject";
      reason = `RSI=${rsi.toFixed(1)}<${RSI_CLIMAX_OVERSOLD} 且价格跌破布林下轨(${bbLow?.toFixed(2)})，疑似恐慌杀跌，禁止追空（SCS hard rule）`;
      directionalBias = "neutral";
    } else if (rsi > RSI_WARNING_OVERBOUGHT) {
      climaxRisk = "warning";
      reason = `RSI=${rsi.toFixed(1)}>${RSI_WARNING_OVERBOUGHT}，超买预警，不追多但可持单/减仓`;
      directionalBias = "neutral"; // 不追多
      ok = true;
      result = "proceed";
    } else if (rsi < RSI_WARNING_OVERSOLD) {
      climaxRisk = "warning";
      reason = `RSI=${rsi.toFixed(1)}<${RSI_WARNING_OVERSOLD}，超卖预警，不追空但可持单/减仓`;
      directionalBias = "neutral"; // 不追空
      ok = true;
      result = "proceed";
    } else {
      climaxRisk = "none";
      reason = `RSI=${rsi.toFixed(1)} 处于正常区间`;
      ok = true;
      result = "proceed";
    }
  } else {
    reason = "缺少 RSI 数据，跳过高潮判断（按无高潮处理）";
    ok = true;
    result = "proceed";
  }

  return { ok, result, climaxRisk, reason, directionalBias };
}

// ---------------------------------------------------------------------------
// G4：风控熔断
// ---------------------------------------------------------------------------

function checkG4(
  portfolio: GatePortfolio,
  currentPrice: number,
  symbol?: string,
): { ok: boolean; result: GateVerdict; reason: string } {
  // 1) 组合最大回撤熔断
  const dd = portfolio.maxDrawdown;
  if (isNumber(dd) && dd > MAX_PORTFOLIO_DRAWDOWN_PCT) {
    return {
      ok: false,
      result: "reject",
      reason: `组合最大回撤 ${(dd * 100).toFixed(2)}% 超过阈值 ${(MAX_PORTFOLIO_DRAWDOWN_PCT * 100).toFixed(0)}%，触发熔断，禁止新开仓`,
    };
  }

  // 2) 单票集中度检查：当前 symbol 持仓市值 / 组合总价值 > 30% -> reject
  if (symbol && isNumber(portfolio.totalValue) && portfolio.totalValue > 0) {
    const pos = portfolio.positions.find((p) => p.symbol === symbol);
    if (pos && pos.quantity > 0) {
      const price = currentPrice > 0 ? currentPrice : pos.currentPrice;
      const mv = pos.quantity * price;
      const ratio = mv / portfolio.totalValue;
      if (ratio > SINGLE_POSITION_CONCENTRATION_PCT) {
        return {
          ok: false,
          result: "reject",
          reason: `${symbol} 持仓市值占组合 ${(ratio * 100).toFixed(2)}% > ${(SINGLE_POSITION_CONCENTRATION_PCT * 100).toFixed(0)}%，已达单票集中度上限，禁止继续加仓`,
        };
      }
    }
  }

  // 3) 现金非负兜底（极端异常保护）
  if (!isNumber(portfolio.cash) || portfolio.cash < 0) {
    return {
      ok: false,
      result: "wait",
      reason: "现金数据异常，等待组合数据修正",
    };
  }

  return { ok: true, result: "proceed", reason: "风控检查通过：回撤未超限、单票集中度未超标" };
}

// ---------------------------------------------------------------------------
// 主入口：runGateDiagnosis
// ---------------------------------------------------------------------------

export function runGateDiagnosis(input: GateInput): GateDiagnosis {
  const { bars, technicals, portfolio, currentPrice, symbol } = input;
  const safeBars = bars ?? [];

  const nodes: GateNode[] = [];

  // ---------- G1 ----------
  const g1 = checkG1(safeBars);
  nodes.push({
    id: "g1_data",
    question: "数据是否充足？",
    answer: g1.ok ? "yes" : "no",
    result: g1.ok ? "proceed" : "wait",
    reason: g1.reason,
  });
  if (!g1.ok) {
    return buildEarlyReturn({
      verdict: "wait",
      nodes,
      marketRegime: "unknown",
      direction: "neutral",
      climaxRisk: "none",
      emaState: {
        ema8: NaN,
        ema21: NaN,
        ema55: NaN,
        priceVsEma21: currentPrice >= 0 ? "above" : "below",
        ema21Slope: "flat",
      },
      rejectReason: g1.reason,
    });
  }

  // ---------- G2 ----------
  const g2 = checkG2(safeBars, technicals, currentPrice);
  nodes.push({
    id: "g2_cycle",
    question: "市场周期可识别？",
    answer: g2.ok ? "yes" : "no",
    result: g2.ok ? "proceed" : "wait",
    reason: g2.reason,
  });
  if (!g2.ok) {
    return buildEarlyReturn({
      verdict: "wait",
      nodes,
      marketRegime: "unknown",
      direction: "neutral",
      climaxRisk: "none",
      emaState: {
        ema8: g2.ema8,
        ema21: g2.ema21,
        ema55: g2.ema55,
        priceVsEma21: g2.priceVsEma21,
        ema21Slope: g2.ema21Slope,
      },
      rejectReason: g2.reason,
    });
  }

  // ---------- G3 ----------
  const g3 = checkG3(technicals, currentPrice);
  nodes.push({
    id: "g3_climax",
    question: "是否存在高潮/恐慌风险？",
    answer: g3.ok ? "yes" : "no", // "yes"=无高潮可继续；"no"=检测到高潮，拒绝
    result: g3.result,
    reason: g3.reason,
  });

  // 方向初始判定（基于 regime）
  let direction: "bullish" | "bearish" | "neutral";
  if (g2.regime === "spike_up" || g2.regime === "trend_up") direction = "bullish";
  else if (g2.regime === "spike_down" || g2.regime === "trend_down") direction = "bearish";
  else direction = "neutral";

  // 高潮覆盖方向
  if (g3.climaxRisk === "triggered" || g3.climaxRisk === "warning") {
    // 对 warning 也不追单，方向置 neutral
    direction = "neutral";
  }

  if (g3.result === "reject") {
    return buildEarlyReturn({
      verdict: "reject",
      nodes,
      marketRegime: g2.regime,
      direction: "neutral",
      climaxRisk: g3.climaxRisk,
      emaState: {
        ema8: g2.ema8,
        ema21: g2.ema21,
        ema55: g2.ema55,
        priceVsEma21: g2.priceVsEma21,
        ema21Slope: g2.ema21Slope,
      },
      rejectReason: "市场高潮/恐慌，禁止追单（SCS hard rule）",
    });
  }

  // ---------- G4 ----------
  const g4 = checkG4(portfolio, currentPrice, symbol);
  nodes.push({
    id: "g4_risk",
    question: "风控熔断是否触发？",
    answer: g4.ok ? "yes" : "no", // "yes"=风控通过；"no"=熔断触发
    result: g4.result,
    reason: g4.reason,
  });

  if (g4.result !== "proceed") {
    return buildEarlyReturn({
      verdict: g4.result,
      nodes,
      marketRegime: g2.regime,
      direction: g3.climaxRisk !== "none" ? "neutral" : direction,
      climaxRisk: g3.climaxRisk,
      emaState: {
        ema8: g2.ema8,
        ema21: g2.ema21,
        ema55: g2.ema55,
        priceVsEma21: g2.priceVsEma21,
        ema21Slope: g2.ema21Slope,
      },
      rejectReason: g4.reason,
    });
  }

  // ---------- 全部通过 ----------
  return {
    verdict: "proceed",
    nodes,
    marketRegime: g2.regime,
    direction,
    climaxRisk: g3.climaxRisk,
    emaState: {
      ema8: g2.ema8,
      ema21: g2.ema21,
      ema55: g2.ema55,
      priceVsEma21: g2.priceVsEma21,
      ema21Slope: g2.ema21Slope,
    },
  };
}

// ---------------------------------------------------------------------------
// 短路返回构造器
// ---------------------------------------------------------------------------

function buildEarlyReturn(params: {
  verdict: GateVerdict;
  nodes: GateNode[];
  marketRegime: MarketRegime;
  direction: "bullish" | "bearish" | "neutral";
  climaxRisk: "none" | "warning" | "triggered";
  emaState: GateDiagnosis["emaState"];
  rejectReason?: string;
}): GateDiagnosis {
  return {
    verdict: params.verdict,
    nodes: params.nodes,
    marketRegime: params.marketRegime,
    direction: params.direction,
    climaxRisk: params.climaxRisk,
    emaState: params.emaState,
    gateRejectReason: params.rejectReason,
  };
}
