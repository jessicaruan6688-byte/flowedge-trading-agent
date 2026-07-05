import type {
  AgentAnalysisResult,
  MasterSignal,
  FundamentalMetrics,
  TechnicalIndicators,
} from "@/lib/types";
import { createDoubaoService } from "@/lib/server/ai-service";
import { signalSchema, normalizeSignal, fmt, toAnalystSignal } from "./shared";

const MASTER_ID = "dalio" as const;
const MASTER_NAME = "瑞·达利欧";

const SYSTEM_PROMPT = `You are Ray Dalio, founder of Bridgewater Associates, the world's largest hedge fund. You believe in radical transparency, diversification, and systematic decision-making. Decide bullish, bearish, or neutral.

Core principles:
1. Risk parity: Size positions based on volatility, not conviction alone
2. Diversification is the only free lunch - correlation matters
3. All-weather thinking: consider how this trade performs in different economic regimes
4. Trust in believability-weighted decision making
5. Pain + Reflection = Progress
6. Always consider the probability of being wrong

Signal rules:
- Focus on RISK first before return. High volatility = smaller position or no position
- Correlation with existing holdings matters (in your context, with other HK stocks)
- Bearish when: volatility is extreme (>40% annualized), high correlation with broad market selloffs, leverage indicators flashing red
- Bullish when: Low volatility uptrend, healthy diversification benefits, risk-reward favorable
- Neutral/REJECT when: uncertainty too high, volatility beyond acceptable thresholds

Confidence scale reflects your BELIEVABILITY in this assessment, based on data quality and signal clarity.
Reason in Dalio's thoughtful, principle-referencing style. Mention "diversification", "risk parity", "believability". All reasoning in Simplified Chinese (简体中文).
Return JSON only.`;

export interface DalioParams {
  symbol: string;
  currentPrice: number;
  technicals: TechnicalIndicators;
  fundamentals?: FundamentalMetrics;
  sentiment?: { overallSentiment?: string };
  aiService?: ReturnType<typeof createDoubaoService>;
}

/**
 * Dalio 启发式（风险平价优先）：
 * - annualizedVolatility > 45% → bearish（风险过大）
 * - annualizedVolatility < 20% AND momentum1m > 0 AND RSI 40-70 → bullish
 * - vol 20-45% → neutral
 */
export function dalioFallback(technicals: TechnicalIndicators, fundamentals?: FundamentalMetrics): MasterSignal {
  const vol = (technicals.annualizedVolatility ?? technicals.volatility20d ?? 0) * 100;
  const rsi = technicals.rsi14 ?? technicals.rsi;
  const momentum = (technicals.momentum1m ?? 0) * 100;
  const de = fundamentals?.debtToEquity;
  const atrPct = (technicals.atrPct ?? 0) * 100;

  let signal: MasterSignal["signal"] = "neutral";
  let confidence = 55;
  let reasoning = "信号可信度一般，风险与回报大致平衡——保持观察，等更多证据加权。";
  let keyPoints: string[] = [
    "波动率与动量信号混杂，可信度加权偏中性",
    "风险平价视角下仓位权重应保持基准水平",
    "等待更多宏观与量价证据再做方向决策",
  ];

  if (vol > 45 || atrPct > 5) {
    signal = "bearish";
    confidence = 75;
    reasoning = [
      `风险仪表盘亮红灯：年化波动率高达${fmt(vol, 1)}%，ATR% 达到${fmt(atrPct, 2)}，均显著超过全天候组合可接受的风险阈值。`,
      `根据风险平价原则，资产仓位应与其波动率成反比——如此高的波动意味着仓位必须大幅削减甚至归零。`,
      `高波动环境下历史相关性容易失效，分散化效果显著下降，尾部风险被放大。`,
      `我在《原则》里反复强调：痛苦+反思=进步，但前提是先活过痛苦——此时控制风险是第一要务。`,
      `结论是回避该资产或极小仓位试探，等待波动率回归常态后再重新评估可信度加权。`,
    ].join("");
    keyPoints = [
      "年化波动率超四成五，突破风险平价阈值上限",
      "高波动破坏相关性结构，分散化效果显著减弱",
      "按风险预算大幅降仓，首要目标是保住本金",
    ];
  } else if (vol < 20 && momentum > 0 && rsi !== undefined && rsi >= 40 && rsi <= 70) {
    signal = "bullish";
    confidence = 72;
    reasoning = [
      `风险画像非常健康：年化波动率仅${fmt(vol, 1)}%，处于低波动区间，符合全天候组合里"良性增长"环境的特征。`,
      `趋势面配合良好，近1月动量为+${fmt(momentum, 1)}%，RSI ${fmt(rsi, 0)}处于既不超买也不超卖的健康区间。`,
      `从风险平价视角，低波动+温和上行的资产可以获得较高的风险预算权重，单位风险带来的回报性价比最优。`,
      `这类资产与高波动成长股相关性低，能够有效改善组合的分散化水平，提升整体夏普比率。`,
      `经过可信度加权决策，当前证据充分偏向多头，可按标准风险预算配置。`,
    ].join("");
    keyPoints = [
      "年化波动低于两成，低波动上行符合良性增长象限",
      "动量为正且RSI健康，趋势与情绪未出现极端",
      "风险平价视角下给予较高权重，分散化价值突出",
    ];
  } else if (vol >= 20 && vol <= 45) {
    signal = "neutral";
    confidence = 55;
    reasoning = [
      `波动率${fmt(vol, 1)}%处于中性偏模糊的区间，既没有低波动的舒适感，也尚未触发风险红线。`,
      `动量与RSI信号混合，方向证据不足，可信度加权后无法形成高确信度判断。`,
      `我的原则之一是：在不确定时不要下重注——不知道的事情比知道的事情代价更大。`,
      `保持基准仓位参与，不主动加仓也不清仓，等待波动率走向区间边缘时再做决策。`,
      `继续收集数据，让更多维度的证据浮出水面，再进行下一轮可信度加权。`,
    ].join("");
    keyPoints = [
      "波动率处于两成至四成五中性区间，信号模糊",
      "动量与情绪指标混合，可信度加权后难以定向",
      "保持基准仓位，等待证据清晰后再做风险调整",
    ];
  } else if (de !== undefined && de > 1.5) {
    signal = "bearish";
    confidence = 65;
    reasoning = [
      `除了量价波动之外，我还看到资产负债表上的隐忧：D/E 高达${fmt(de, 2)}，杠杆水平显著偏高。`,
      `高杠杆会在经济下行阶段放大亏损，且无法通过分散化来对冲——这是系统性的脆弱点。`,
      `根据债务周期长期框架，高杠杆主体在流动性收紧时容易遭遇去杠杆冲击。`,
      `即便短期走势尚可，风险平价框架下也需要对这类资产施加额外的风险折扣。`,
      `结论是倾向回避，等待去杠杆风险释放或杠杆率回落至安全水平后再考虑。`,
    ].join("");
    keyPoints = [
      "债务股本比超过1.5，杠杆偏高构成系统性脆弱点",
      "杠杆风险无法通过分散化对冲，需单独折价",
      "回避直至杠杆率回落，规避去杠杆周期冲击",
    ];
  }

  return {
    signal,
    confidence,
    reasoning,
    keyPoints,
    keyMetrics: {
      annualizedVolatilityPct: vol,
      rsi: rsi ?? "N/A",
      momentum1mPct: momentum,
      atrPct,
      debtToEquity: de ?? "N/A",
    },
  };
}

function buildUserPrompt(params: DalioParams): string {
  const { symbol, currentPrice, technicals, fundamentals, sentiment } = params;
  const t = technicals;
  const f = fundamentals ?? {};
  return [
    `股票代码: ${symbol}`,
    `当前价格: HKD ${fmt(currentPrice, 2)}`,
    ``,
    `【风险/波动画像】`,
    `- 年化波动率: ${fmt((t.annualizedVolatility ?? t.volatility20d ?? 0) * 100, 1)}%`,
    `- 日波动率: ${fmt((t.dailyVolatility ?? 0) * 100, 2)}%`,
    `- ATR%: ${fmt((t.atrPct ?? 0) * 100, 2)}%`,
    `- ATR(14): ${fmt(t.atr14 ?? t.atr, 3)}`,
    `- RSI(14): ${fmt(t.rsi14 ?? t.rsi, 1)}`,
    `- ADX(14): ${fmt(t.adx14, 1)}`,
    `- 近1月动量: ${fmt((t.momentum1m ?? 0) * 100, 1)}%`,
    `- 近3月动量: ${fmt((t.momentum3m ?? 0) * 100, 1)}%`,
    `- 量比: ${fmt(t.volumeRatio, 2)}`,
    `- 布林宽度: ${fmt((t.bbWidth ?? 0) * 100, 2)}%`,
    ``,
    `【杠杆/基本面】`,
    `- D/E: ${fmt(f.debtToEquity, 2)}`,
    `- 流动比率: ${fmt(f.currentRatio, 2)}`,
    `- ROE: ${fmt(f.roe, 1)}%`,
    ``,
    `【情绪】`,
    `- ${sentiment?.overallSentiment ?? "无"}`,
    ``,
    `请以 Ray Dalio 的原则视角（风险平价、分散化、可信度加权、全天候），结合以上数据给出 bullish/bearish/neutral，简体中文，返回 JSON。`,
  ].join("\n");
}

export async function analyzeDalio(params: DalioParams): Promise<AgentAnalysisResult> {
  const startedAt = Date.now();
  const ai = params.aiService ?? createDoubaoService();
  const fallback = dalioFallback(params.technicals, params.fundamentals);

  const health = ai.getHealth();
  if (!health.enabled || !health.configured) {
    return {
      masterId: MASTER_ID,
      signal: fallback,
      mode: "disabled",
      latencyMs: Date.now() - startedAt,
      fallbackReason: !health.configured ? "DOUBAO_API_KEY 未配置" : "AI 服务未启用",
    };
  }

  try {
    const result = await ai.generate<{ signal: "bullish" | "bearish" | "neutral"; confidence: number; reasoning: string; keyMetrics?: Record<string, number | string> }>({
      system: SYSTEM_PROMPT,
      user: buildUserPrompt(params),
      schema: signalSchema,
      temperature: 0.2,
    });

    if (result.ok && result.data) {
      return { masterId: MASTER_ID, signal: normalizeSignal(result.data, fallback), mode: "live", latencyMs: result.trace.latencyMs };
    }
    return { masterId: MASTER_ID, signal: fallback, mode: "fallback", latencyMs: result.trace.latencyMs, fallbackReason: result.error?.message };
  } catch (err) {
    return { masterId: MASTER_ID, signal: fallback, mode: "fallback", latencyMs: Date.now() - startedAt, fallbackReason: err instanceof Error ? err.message : String(err) };
  }
}

/** Court runner 默认导出：返回 AnalystSignal。 */
async function run(params: DalioParams | Record<string, unknown>) {
  const p = params as DalioParams;
  const result = await analyzeDalio(p);
  return toAnalystSignal(MASTER_NAME, result.signal, result.mode, result.fallbackReason);
}

export default run;
