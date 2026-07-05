/**
 * 场景分类 + 策略路由模块
 *
 * 根据闸门诊断结果与技术指标，按决策树逻辑对当前市场进行场景分类，
 * 并为每一类场景生成对应的策略提示（StrategyContext），供后续各位大师分析时参考。
 *
 * 纯函数：不做 IO、不调用外部服务、不引入副作用。
 */

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export type ScenarioType =
  | "breakout_bull"     // 向上突破
  | "breakout_bear"     // 向下跌破
  | "pullback_buy"      // 回调买入（上升趋势中的回调）
  | "rebound_sell"      // 反弹做空（下降趋势中的反弹）
  | "range_play"        // 区间交易
  | "oversold_bounce"   // 超跌反弹
  | "overbought_sell"   // 超买回落
  | "spike_follow"      // 尖峰顺势
  | "mean_reversion"    // 均值回归
  | "no_opportunity";   // 无机会

export interface StrategyContext {
  focus: string;            // 本次分析重点
  prohibited: string[];     // 禁止事项
  keyIndicators: string[];  // 重点关注的指标
  entryStrategy: string;    // 建议入场方式
  invalidationLevel: string; // 失效位
}

export interface ScenarioResult {
  scenario: ScenarioType;
  scenarioName: string;     // 中文名
  confidence: number;       // 0-100
  description: string;      // 一句话描述
  strategyContext: StrategyContext;
}

export interface ClassifyScenarioInput {
  gateDiagnosis: {
    marketRegime: string;
    direction: string;
    climaxRisk: string;
  };
  technicals: {
    rsi?: number;
    macd?: number;
    adx14?: number;
    atr?: number;
    ema8?: number;
    ema21?: number;
    ema55?: number;
    bollingerUpper?: number;
    bollingerLower?: number;
    volumeRatio?: number;
    volatility20d?: number;
  };
  currentPrice: number;
  bars: Array<{ close: number; high: number; low: number; open: number }>;
  userIdea?: string;
}

// ---------------------------------------------------------------------------
// 策略上下文模板
// ---------------------------------------------------------------------------

const STRATEGY_CONTEXTS: Record<ScenarioType, {
  name: string;
  description: string;
  context: StrategyContext;
}> = {
  breakout_bull: {
    name: "向上突破",
    description: "价格放量突破近期高点，趋势启动，回踩确认后做多",
    context: {
      focus: "突破有效性确认（量能配合+回踩不破）",
      prohibited: ["追高潮", "逆势做空", "突破瞬间满仓追入"],
      keyIndicators: ["量能放大", "回踩确认", "ADX趋势强度", "突破位前高"],
      entryStrategy: "回踩突破位不破时入场，或放量长阳确认后轻仓试多",
      invalidationLevel: "跌破突破位下方1倍ATR",
    },
  },
  breakout_bear: {
    name: "向下跌破",
    description: "价格放量跌破近期低点，下跌趋势启动，反弹确认后做空",
    context: {
      focus: "跌破有效性确认（放量+反弹承压）",
      prohibited: ["抄底搏反弹", "逆势做多", "恐慌杀跌时追空"],
      keyIndicators: ["量能放大", "反弹承压", "ADX趋势强度", "跌破位前低"],
      entryStrategy: "反弹至跌破位下方不破时入场，或放量长阴确认后轻仓试空",
      invalidationLevel: "站稳跌破位上方1倍ATR",
    },
  },
  pullback_buy: {
    name: "回调买入",
    description: "上升趋势中价格回调至EMA21附近企稳，是顺势低吸机会",
    context: {
      focus: "回调到位+止跌信号（锤子线/缩量/EMA支撑）",
      prohibited: ["追涨", "过早抄底", "在EMA21下方重仓"],
      keyIndicators: ["EMA21支撑", "缩量回调", "MACD柱缩量", "止跌K线形态"],
      entryStrategy: "价格回踩EMA21/EMA55附近出现止跌信号时分批建仓",
      invalidationLevel: "有效跌破EMA55或前一波回调低点",
    },
  },
  rebound_sell: {
    name: "反弹做空",
    description: "下降趋势中价格反弹至EMA21附近承压，是顺势做空机会",
    context: {
      focus: "反弹到位+滞涨信号（射击之星/放量滞涨/EMA压制）",
      prohibited: ["杀跌追空", "过早抄底", "在EMA21上方重仓"],
      keyIndicators: ["EMA21压制", "缩量反弹", "MACD柱缩短", "滞涨K线形态"],
      entryStrategy: "价格反弹至EMA21/EMA55附近出现滞涨信号时分批建空仓",
      invalidationLevel: "有效站稳EMA55或前一波反弹高点",
    },
  },
  range_play: {
    name: "区间交易",
    description: "市场处于震荡区间，适合区间高抛低吸，等待方向选择",
    context: {
      focus: "区间边界识别（支撑/阻力）+ 反转K线信号",
      prohibited: ["追涨杀跌", "突破方向前重仓", "忽略区间上下轨"],
      keyIndicators: ["布林带上下轨", "RSI超买超卖", "支撑阻力位", "量能萎缩"],
      entryStrategy: "区间下轨附近缩量企稳做多，区间上轨附近放量滞涨做空",
      invalidationLevel: "有效突破区间上/下轨2倍ATR并站稳",
    },
  },
  oversold_bounce: {
    name: "超跌反弹",
    description: "RSI超卖+价格跌破布林下轨，存在技术性反弹机会，轻仓博弈",
    context: {
      focus: "超跌反转信号（底背离/长下影/放量止跌）",
      prohibited: ["重仓搏反弹", "持仓过久", "将反弹误判为反转"],
      keyIndicators: ["RSI底背离", "布林下轨支撑", "长下影K线", "恐慌量能"],
      entryStrategy: "出现明确止跌K线形态（锤子线/阳包阴）后轻仓试多，严格止损",
      invalidationLevel: "跌破反弹启动K线最低点",
    },
  },
  overbought_sell: {
    name: "超买回落",
    description: "RSI超买+价格突破布林上轨，存在技术性回落机会，可轻仓试空",
    context: {
      focus: "超买反转信号（顶背离/长上影/放量滞涨）",
      prohibited: ["重仓搏回落", "持仓过久", "将回落误判为趋势反转"],
      keyIndicators: ["RSI顶背离", "布林上轨压制", "长上影K线", "放量滞涨"],
      entryStrategy: "出现明确滞涨K线形态（射击之星/阴包阳）后轻仓试空，严格止损",
      invalidationLevel: "突破回落启动K线最高点",
    },
  },
  spike_follow: {
    name: "尖峰顺势",
    description: "价格急速拉升形成尖峰，等待SPS（二次拉升点）回撤确认后再入场，不追高",
    context: {
      focus: "SPS（Secondary Point of Support）回撤确认，等待缩量回踩",
      prohibited: ["尖峰顶部追高", "逆势做空尖峰", "未等回撤就入场"],
      keyIndicators: ["缩量回撤", "前高支撑", "量能再放大", "EMA8支撑"],
      entryStrategy: "等待价格回撤至突破起点/EMA8附近企稳，量能再次放大时顺势跟进",
      invalidationLevel: "回撤跌破尖峰启动点下方1倍ATR",
    },
  },
  mean_reversion: {
    name: "均值回归",
    description: "价格偏离均值过大后向均线回归，适合轻仓做回归行情",
    context: {
      focus: "均值回归幅度判断+反转信号",
      prohibited: ["重仓", "持仓过久", "在趋势明确时做均值回归"],
      keyIndicators: ["布林带宽度", "价格与EMA21偏离度", "RSI极值", "成交量萎缩"],
      entryStrategy: "价格偏离EMA21达2倍ATR以上且出现反转信号时轻仓反向操作",
      invalidationLevel: "继续偏离均值超过1倍ATR未回归",
    },
  },
  no_opportunity: {
    name: "无明确机会",
    description: "当前市场不符合任何可交易场景，建议观望等待",
    context: {
      focus: "持续观察，等待交易信号出现",
      prohibited: ["强行开仓", "凭感觉交易", "因手痒入场"],
      keyIndicators: ["耐心等待", "跟踪关键价位", "等待明确信号"],
      entryStrategy: "不入场，继续观察，等待更清晰的交易机会",
      invalidationLevel: "无",
    },
  },
};

// ---------------------------------------------------------------------------
// 工具函数
// ---------------------------------------------------------------------------

function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

function last<T>(arr: T[], n: number): T[] {
  if (arr.length <= n) return arr.slice();
  return arr.slice(arr.length - n);
}

/** 判断近N根K线是否处于回调状态（收盘逐根走低或最高价逐根下移） */
function isRecentPullback(
  bars: Array<{ close: number; high: number; low: number }>,
  lookback: number,
): boolean {
  const tail = last(bars, lookback);
  if (tail.length < 2) return false;
  // 近N根内至少有60%的K线收盘走低，且最后一根的高点低于第一根的高点
  let downCount = 0;
  for (let i = 1; i < tail.length; i++) {
    if (tail[i].close < tail[i - 1].close) downCount++;
  }
  const ratio = downCount / (tail.length - 1);
  const highFirst = tail[0].high;
  const highLast = tail[tail.length - 1].high;
  return ratio >= 0.6 && highLast < highFirst;
}

/** 判断近N根K线是否处于反弹状态 */
function isRecentRebound(
  bars: Array<{ close: number; high: number; low: number }>,
  lookback: number,
): boolean {
  const tail = last(bars, lookback);
  if (tail.length < 2) return false;
  let upCount = 0;
  for (let i = 1; i < tail.length; i++) {
    if (tail[i].close > tail[i - 1].close) upCount++;
  }
  const ratio = upCount / (tail.length - 1);
  const lowFirst = tail[0].low;
  const lowLast = tail[tail.length - 1].low;
  return ratio >= 0.6 && lowLast > lowFirst;
}

/** 计算近N根K线的最高价/最低价 */
function recentHighLow(
  bars: Array<{ high: number; low: number }>,
  lookback: number,
): { high: number; low: number } {
  const tail = last(bars, lookback);
  let hi = -Infinity;
  let lo = Infinity;
  for (const b of tail) {
    if (b.high > hi) hi = b.high;
    if (b.low < lo) lo = b.low;
  }
  return { high: hi, low: lo };
}

// ---------------------------------------------------------------------------
// 主入口：classifyScenario
// ---------------------------------------------------------------------------

export function classifyScenario(input: ClassifyScenarioInput): ScenarioResult {
  const { gateDiagnosis, technicals, currentPrice, bars } = input;
  const { marketRegime, climaxRisk } = gateDiagnosis;
  const {
    rsi, macd, adx14, volumeRatio,
    ema21, bollingerUpper, bollingerLower,
  } = technicals;

  const safeBars = bars ?? [];

  // 构建无机会结果
  const buildNoOpportunity = (reason: string, confidence = 50): ScenarioResult => ({
    scenario: "no_opportunity",
    scenarioName: STRATEGY_CONTEXTS.no_opportunity.name,
    confidence,
    description: reason,
    strategyContext: STRATEGY_CONTEXTS.no_opportunity.context,
  });

  // ---- 1. 高潮禁入 ----
  if (climaxRisk === "triggered") {
    return buildNoOpportunity("市场处于高潮/恐慌状态，禁止入场（SCS硬规则）", 90);
  }

  // ---- 2. RSI<30 + 价格<bollingerLower → oversold_bounce ----
  if (isNumber(rsi) && isNumber(bollingerLower) && rsi < 30 && currentPrice < bollingerLower) {
    const conf = Math.min(100, 55 + (30 - rsi) * 2); // RSI越低置信度越高
    return {
      scenario: "oversold_bounce",
      scenarioName: STRATEGY_CONTEXTS.oversold_bounce.name,
      confidence: Math.round(conf),
      description: `RSI=${rsi.toFixed(1)}<30 且价格跌破布林下轨，存在超跌反弹机会（轻仓）`,
      strategyContext: STRATEGY_CONTEXTS.oversold_bounce.context,
    };
  }

  // ---- 3. RSI>70 + 价格>bollingerUpper → overbought_sell ----
  if (isNumber(rsi) && isNumber(bollingerUpper) && rsi > 70 && currentPrice > bollingerUpper) {
    const conf = Math.min(100, 55 + (rsi - 70) * 2);
    return {
      scenario: "overbought_sell",
      scenarioName: STRATEGY_CONTEXTS.overbought_sell.name,
      confidence: Math.round(conf),
      description: `RSI=${rsi.toFixed(1)}>70 且价格突破布林上轨，存在超买回落机会（轻仓）`,
      strategyContext: STRATEGY_CONTEXTS.overbought_sell.context,
    };
  }

  // ---- 4. spike_up + ADX>25 → spike_follow（等回撤不追高）----
  if (marketRegime === "spike_up" && isNumber(adx14) && adx14 > 25) {
    return {
      scenario: "spike_follow",
      scenarioName: STRATEGY_CONTEXTS.spike_follow.name,
      confidence: Math.min(85, 60 + (adx14 - 25)),
      description: `价格急速拉升形成尖峰（ADX=${adx14.toFixed(1)}），等待SPS回撤确认后顺势跟进`,
      strategyContext: STRATEGY_CONTEXTS.spike_follow.context,
    };
  }

  // ---- 5. spike_down + ADX>25 → no_opportunity ----
  if (marketRegime === "spike_down" && isNumber(adx14) && adx14 > 25) {
    return buildNoOpportunity(
      `价格急速下跌形成尖峰（ADX=${adx14.toFixed(1)}），下跌动能未释放完毕，观望等待`,
      75,
    );
  }

  // ---- 6. trend_up + MACD>0 + price>ema21 且近5根回调 → pullback_buy ----
  if (
    marketRegime === "trend_up"
    && isNumber(macd) && macd > 0
    && isNumber(ema21) && currentPrice > ema21
    && isRecentPullback(safeBars, 5)
  ) {
    const baseConf = 70;
    const adxBonus = isNumber(adx14) && adx14 > 25 ? 10 : 0;
    return {
      scenario: "pullback_buy",
      scenarioName: STRATEGY_CONTEXTS.pullback_buy.name,
      confidence: Math.min(90, baseConf + adxBonus),
      description: "上升趋势中MACD>0且价格在EMA21上方，近5根K线回调，等待止跌后顺势低吸",
      strategyContext: STRATEGY_CONTEXTS.pullback_buy.context,
    };
  }

  // ---- 7. trend_down + MACD<0 + price<ema21 且近5根反弹 → rebound_sell ----
  if (
    marketRegime === "trend_down"
    && isNumber(macd) && macd < 0
    && isNumber(ema21) && currentPrice < ema21
    && isRecentRebound(safeBars, 5)
  ) {
    const baseConf = 70;
    const adxBonus = isNumber(adx14) && adx14 > 25 ? 10 : 0;
    return {
      scenario: "rebound_sell",
      scenarioName: STRATEGY_CONTEXTS.rebound_sell.name,
      confidence: Math.min(90, baseConf + adxBonus),
      description: "下降趋势中MACD<0且价格在EMA21下方，近5根K线反弹，等待滞涨后顺势做空",
      strategyContext: STRATEGY_CONTEXTS.rebound_sell.context,
    };
  }

  // ---- 8. range → range_play ----
  if (marketRegime === "range") {
    return {
      scenario: "range_play",
      scenarioName: STRATEGY_CONTEXTS.range_play.name,
      confidence: 65,
      description: "市场处于震荡区间，适合区间高抛低吸",
      strategyContext: STRATEGY_CONTEXTS.range_play.context,
    };
  }

  // ---- 9. 价格突破近20根高点 + 放量 + ADX>20 → breakout_bull ----
  const recentHL20 = recentHighLow(safeBars, 20);
  if (
    currentPrice > recentHL20.high
    && isNumber(volumeRatio) && volumeRatio > 1.2
    && isNumber(adx14) && adx14 > 20
  ) {
    const conf = 65 + (volumeRatio - 1.2) * 20 + (adx14 - 20);
    return {
      scenario: "breakout_bull",
      scenarioName: STRATEGY_CONTEXTS.breakout_bull.name,
      confidence: Math.min(90, Math.round(conf)),
      description: `价格突破近20根高点（量比=${volumeRatio.toFixed(2)}，ADX=${adx14.toFixed(1)}），突破行情启动`,
      strategyContext: STRATEGY_CONTEXTS.breakout_bull.context,
    };
  }

  // ---- 10. 价格跌破近20根低点 + 放量 + ADX>20 → breakout_bear ----
  if (
    currentPrice < recentHL20.low
    && isNumber(volumeRatio) && volumeRatio > 1.2
    && isNumber(adx14) && adx14 > 20
  ) {
    const conf = 65 + (volumeRatio - 1.2) * 20 + (adx14 - 20);
    return {
      scenario: "breakout_bear",
      scenarioName: STRATEGY_CONTEXTS.breakout_bear.name,
      confidence: Math.min(90, Math.round(conf)),
      description: `价格跌破近20根低点（量比=${volumeRatio.toFixed(2)}，ADX=${adx14.toFixed(1)}），跌破行情启动`,
      strategyContext: STRATEGY_CONTEXTS.breakout_bear.context,
    };
  }

  // ---- 11. 其他 → no_opportunity ----
  return buildNoOpportunity("当前市场不满足任何可交易场景条件，建议观望", 50);
}
