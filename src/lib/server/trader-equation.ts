/**
 * 交易者方程硬检查模块（Trader Equation）
 *
 * 参考 PA_Agent §10.3 的交易者方程思想，在开仓前对每笔交易进行
 * 风险收益比、胜率、期望值的硬校验。任何一项不达标则直接拒绝开仓。
 *
 * 纯函数：不做 IO、不调用外部服务、不引入副作用。
 */

// ---------------------------------------------------------------------------
// 类型
// ---------------------------------------------------------------------------

export interface TraderEquationResult {
  passed: boolean;
  reason: string;
  riskRewardRatio: number;      // R:R 比（预期盈利/预期亏损）
  estimatedWinRate: number;     // 预估胜率 0-1
  expectedValue: number;        // 期望值（每承担1元风险的期望收益）
  riskPerShare: number;         // 每股风险
  rewardPerShare: number;       // 每股收益
  suggestion?: string;          // 改善建议（未通过时）
}

export interface CheckTraderEquationInput {
  direction: "long" | "short";
  entryPrice: number;
  stopLoss: number;
  takeProfit: number;
  /** 场景置信度 0-100 */
  scenarioConfidence?: number;
  /** 趋势强度 */
  adx14?: number;
}

// ---------------------------------------------------------------------------
// 常量
// ---------------------------------------------------------------------------

/** 最低要求 R:R */
const MIN_RISK_REWARD_RATIO = 1.5;
/** 止损占入场价的最小比例（过紧） */
const MIN_STOP_PCT = 0.005;   // 0.5%
/** 止损占入场价的最大比例（过宽） */
const MAX_STOP_PCT = 0.08;    // 8%
/** 胜率上下限 */
const MIN_WIN_RATE = 0.25;
const MAX_WIN_RATE = 0.75;
/** 基础胜率 */
const BASE_WIN_RATE = 0.5;

// ---------------------------------------------------------------------------
// 主入口：checkTraderEquation
// ---------------------------------------------------------------------------

export function checkTraderEquation(input: CheckTraderEquationInput): TraderEquationResult {
  const {
    direction,
    entryPrice,
    stopLoss,
    takeProfit,
    scenarioConfidence,
    adx14,
  } = input;

  // ------- 1. 基础参数合法性校验 -------
  if (entryPrice <= 0 || stopLoss <= 0 || takeProfit <= 0) {
    return {
      passed: false,
      reason: "入场价、止损价、止盈价必须为正数",
      riskRewardRatio: 0,
      estimatedWinRate: 0,
      expectedValue: 0,
      riskPerShare: 0,
      rewardPerShare: 0,
      suggestion: "请检查价格数据是否正确",
    };
  }

  // 方向与止损/止盈位的一致性校验
  if (direction === "long") {
    if (stopLoss >= entryPrice) {
      return {
        passed: false,
        reason: "做多时止损价必须低于入场价",
        riskRewardRatio: 0,
        estimatedWinRate: 0,
        expectedValue: 0,
        riskPerShare: Math.abs(entryPrice - stopLoss),
        rewardPerShare: Math.abs(takeProfit - entryPrice),
        suggestion: "将止损价设在入场价下方",
      };
    }
    if (takeProfit <= entryPrice) {
      return {
        passed: false,
        reason: "做多时止盈价必须高于入场价",
        riskRewardRatio: 0,
        estimatedWinRate: 0,
        expectedValue: 0,
        riskPerShare: Math.abs(entryPrice - stopLoss),
        rewardPerShare: Math.abs(takeProfit - entryPrice),
        suggestion: "将止盈价设在入场价上方",
      };
    }
  } else {
    // short
    if (stopLoss <= entryPrice) {
      return {
        passed: false,
        reason: "做空时止损价必须高于入场价",
        riskRewardRatio: 0,
        estimatedWinRate: 0,
        expectedValue: 0,
        riskPerShare: Math.abs(entryPrice - stopLoss),
        rewardPerShare: Math.abs(takeProfit - entryPrice),
        suggestion: "将止损价设在入场价上方",
      };
    }
    if (takeProfit >= entryPrice) {
      return {
        passed: false,
        reason: "做空时止盈价必须低于入场价",
        riskRewardRatio: 0,
        estimatedWinRate: 0,
        expectedValue: 0,
        riskPerShare: Math.abs(entryPrice - stopLoss),
        rewardPerShare: Math.abs(takeProfit - entryPrice),
        suggestion: "将止盈价设在入场价下方",
      };
    }
  }

  // ------- 2. 计算 risk / reward / R:R -------
  const riskPerShare = Math.abs(entryPrice - stopLoss);
  const rewardPerShare = Math.abs(takeProfit - entryPrice);
  const riskRewardRatio = riskPerShare > 0 ? rewardPerShare / riskPerShare : 0;

  // ------- 3. 胜率估算（启发式）-------
  let winRate = BASE_WIN_RATE;
  if (typeof scenarioConfidence === "number" && Number.isFinite(scenarioConfidence)) {
    if (scenarioConfidence > 70) winRate += 0.10;
    else if (scenarioConfidence < 40) winRate -= 0.10;
  }
  if (typeof adx14 === "number" && Number.isFinite(adx14) && adx14 > 25) {
    winRate += 0.05;
  }
  if (riskRewardRatio > 3) {
    winRate -= 0.10;
  } else if (riskRewardRatio > 2) {
    winRate -= 0.05;
  }
  const estimatedWinRate = Math.max(MIN_WIN_RATE, Math.min(MAX_WIN_RATE, winRate));

  // ------- 4. 期望值（归一化为每承担1元风险的期望收益）-------
  // 原值：EV = winRate * reward - (1-winRate) * risk
  // 归一化：EV_per_risk = winRate * R:R - (1-winRate)
  const expectedValue = estimatedWinRate * riskRewardRatio - (1 - estimatedWinRate);

  // ------- 5. 硬检查 -------
  const reasons: string[] = [];
  const suggestions: string[] = [];

  // 5.1 R:R 检查
  const rrOk = riskRewardRatio >= MIN_RISK_REWARD_RATIO;
  if (!rrOk) {
    reasons.push(`风险收益比 ${riskRewardRatio.toFixed(2)}:1 低于最低要求 ${MIN_RISK_REWARD_RATIO}:1`);
    suggestions.push("建议等待更佳入场位或上调止盈目标");
  }

  // 5.2 期望值检查
  const evOk = expectedValue > 0;
  if (!evOk) {
    reasons.push(`期望值为负（${expectedValue.toFixed(3)}），长期必亏`);
    suggestions.push("此笔交易期望为负，建议放弃");
  }

  // 5.3 止损不能太紧
  const stopPct = riskPerShare / entryPrice;
  const stopTooTight = stopPct < MIN_STOP_PCT;
  const stopTooWide = stopPct > MAX_STOP_PCT;
  if (stopTooTight) {
    reasons.push(`止损幅度过小（${(stopPct * 100).toFixed(2)}% < ${(MIN_STOP_PCT * 100).toFixed(1)}%），容易被噪音扫损`);
    suggestions.push("止损过近易被噪音扫损，建议放宽至1倍ATR");
  }
  if (stopTooWide) {
    reasons.push(`止损幅度过大（${(stopPct * 100).toFixed(2)}% > ${(MAX_STOP_PCT * 100).toFixed(0)}%），单笔风险过高`);
    suggestions.push("止损过宽风险过大，建议缩小仓位或放弃");
  }

  const passed = rrOk && evOk && !stopTooTight && !stopTooWide;

  let reason: string;
  if (passed) {
    reason = `交易者方程通过：R:R=${riskRewardRatio.toFixed(2)}:1，胜率≈${(estimatedWinRate * 100).toFixed(0)}%，期望值=${expectedValue.toFixed(3)}（每承担1元风险）`;
  } else {
    reason = `交易者方程未通过：${reasons.join("；")}`;
  }

  return {
    passed,
    reason,
    riskRewardRatio: Number(riskRewardRatio.toFixed(4)),
    estimatedWinRate: Number(estimatedWinRate.toFixed(4)),
    expectedValue: Number(expectedValue.toFixed(4)),
    riskPerShare: Number(riskPerShare.toFixed(4)),
    rewardPerShare: Number(rewardPerShare.toFixed(4)),
    suggestion: passed ? undefined : suggestions.join("；"),
  };
}
