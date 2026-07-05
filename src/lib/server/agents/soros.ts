import type {
  AgentAnalysisResult,
  MasterSignal,
  FundamentalMetrics,
  TechnicalIndicators,
} from "@/lib/types";
import { createDoubaoService } from "@/lib/server/ai-service";
import { signalSchema, normalizeSignal, fmt, toAnalystSignal } from "./shared";

const MASTER_ID = "soros" as const;
const MASTER_NAME = "乔治·索罗斯";

const SYSTEM_PROMPT = `You are George Soros, the legendary macro investor known for reflexivity theory and bubble detection. Decide bullish, bearish, or neutral.

Core principles:
1. Reflexivity: Prices influence fundamentals, creating self-reinforcing cycles that eventually collapse
2. Boom-bust sequences: Identify when a trend has become excessive and is nearing reversal
3. Asymmetric risk-reward: Seek opportunities where upside potential far exceeds downside risk
4. Cut losses quickly when the thesis breaks - survival first
5. Market sentiment and positioning matter more than pure fundamentals near extremes

Signal rules:
- Bearish when: High RSI (>75), extreme momentum (>20% gain short-term), declining volume on up moves, signs of euphoria/exhaustion. This is a bubble top candidate.
- Bullish when: Panic selling with extreme negative sentiment, high volume capitulation, prices far below fundamental value due to overreaction (reflexivity on the downside creating opportunity)
- Neutral when: No reflexive pattern detected, market in equilibrium

Confidence scale:
- 80-100%: Clear reflexive extreme with supporting evidence from volume/RSI/momentum
- 60-79%: Emerging reflexive pattern but not yet at extreme
- 40-59%: Ambiguous signals
- 20-39%: Weak pattern against your thesis
- 0-19%: No clear edge from reflexivity perspective

Key Soros metrics: RSI extremes, volume divergence, price momentum, volatility spikes, sentiment extremes.
Reason in Soros's decisive, conviction-driven voice. Reference "reflexivity" and "boom-bust". All reasoning text in Simplified Chinese (简体中文).
Return JSON only.`;

export interface SorosParams {
  symbol: string;
  currentPrice: number;
  technicals: TechnicalIndicators;
  fundamentals?: FundamentalMetrics;
  sentiment?: { overallSentiment?: string };
  aiService?: ReturnType<typeof createDoubaoService>;
}

/**
 * Soros 启发式：
 * - RSI>80 AND momentum1m>15% → bearish (泡沫顶部)
 * - RSI<20 AND momentum1m<-15% → bullish (恐慌底)
 * - RSI>70 AND volumeRatio<0.8 → bearish (上涨缩量)
 * - RSI<30 AND volumeRatio>1.5 → bullish (放量恐慌)
 */
export function sorosFallback(technicals: TechnicalIndicators, sentiment?: { overallSentiment?: string }): MasterSignal {
  const rsi = technicals.rsi14 ?? technicals.rsi;
  const momentum = (technicals.momentum1m ?? technicals.dailyChangePct ?? 0) * 100; // %
  const volRatio = technicals.volumeRatio ?? 1;
  const vol = (technicals.annualizedVolatility ?? technicals.volatility20d ?? 0) * 100;

  let signal: MasterSignal["signal"] = "neutral";
  let confidence = 50;
  let reasoning = "市场处于均衡状态，反身性循环尚未形成明显趋势——暂时观望。";
  let keyPoints: string[] = [
    "多空力量均衡，反身性循环尚未启动",
    "价格围绕基本面波动，无极端情绪信号",
    "保持在场外耐心等待泡沫或恐慌信号",
  ];

  const euphoria = (rsi !== undefined && rsi > 80) && momentum > 15;
  const panicBottom = (rsi !== undefined && rsi < 20) && momentum < -15;
  const weakRally = (rsi !== undefined && rsi > 70) && volRatio < 0.8;
  const capitulation = (rsi !== undefined && rsi < 30) && volRatio > 1.5;

  if (euphoria) {
    signal = "bearish";
    confidence = 82;
    reasoning = [
      `反身性已进入高潮阶段：RSI 飙至${fmt(rsi, 0)}的超买区，近1月累计涨幅高达${fmt(momentum, 1)}%，价格正在脱离基本面自我强化。`,
      `这就是我所说的繁荣-萧条序列的顶点：上涨不再基于估值，而是基于对进一步上涨的预期本身。`,
      `市场情绪呈现典型的欣快症特征，跟风资金忽视所有风险提示。`,
      `根据我的经验，当趋势走到自我强化的末期，反转往往比所有人预期的都要猛烈。`,
      `我选择站在空头一边——先建小仓试探，一旦破位立即加仓，设好硬止损以防判断过早。`,
    ].join("");
    keyPoints = [
      "RSI超买叠加月涨幅过大，反身性狂热见顶迹象明显",
      "量价或现背离，跟风资金进场但动能接近衰竭",
      "繁荣-萧条序列临近拐点，建立空头头寸并严设止损",
    ];
  } else if (panicBottom) {
    signal = "bullish";
    confidence = 80;
    reasoning = [
      `恐慌性抛售创造了绝佳的非对称机会：RSI 跌至${fmt(rsi, 0)}的深度超卖区，近1月跌幅${fmt(Math.abs(momentum), 1)}%，抛售已进入自我强化阶段。`,
      `这正是下行反身性过度的典型时刻——价格下跌本身又引发更多抛压，与基本面的偏离越来越大。`,
      `历史告诉我，在所有人都急于逃命时入场，赔率往往最惊人。`,
      `我会小笔试探性做多，等待右侧确认再加仓，止损设在恐慌低点之下。`,
      `别人恐惧时我贪婪——这不是口号，而是反身性理论给出的入场时机。`,
    ].join("");
    keyPoints = [
      "RSI极度超卖叠加月跌幅过大，恐慌反身性进入尾段",
      "价格严重偏离基本面，非对称风险收益比凸显",
      "分批建立多头头寸，等待右侧确认并严守止损",
    ];
  } else if (weakRally) {
    signal = "bearish";
    confidence = 65;
    reasoning = [
      `上涨正在显露疲态：RSI 维持在${fmt(rsi, 0)}的高位，但量比仅${fmt(volRatio, 2)}，价格新高却没有得到成交量的配合。`,
      `这种量价背离是反身性上行动能枯竭的早期信号——上涨越来越依靠惯性，而非新资金的涌入。`,
      `繁荣-萧条序列的黄昏阶段往往就是这样：价格还在飘，但燃料已经烧完。`,
      `我不会全力做空，但会开始构建防御性空头头寸，一旦跌破关键位再加仓。`,
      `关键是控制风险——若重新放量突破，我会立即平仓认错，存活比面子重要。`,
    ].join("");
    keyPoints = [
      "价格高位震荡但量能萎缩，量价背离显现",
      "反身性上行缺乏新增资金推动，动能枯竭",
      "防御性做空布局，严格止损防止假突破",
    ];
  } else if (capitulation) {
    signal = "bullish";
    confidence = 68;
    reasoning = [
      `放量恐慌信号出现：RSI ${fmt(rsi, 0)}进入超卖区，量比高达${fmt(volRatio, 2)}，这是典型的投降式抛售特征。`,
      `最后一批恐慌的筹码正在离场，反身性下行链条可能接近尾声——弱者被迫卖出，正是强者接货的时刻。`,
      `我观察到波动率放大，但这种恐慌放量往往形成阶段性底部。`,
      `赔率开始向多头倾斜，但还不是满仓时刻——我会先建立观察仓。`,
      `等待价格企稳和量能回落后的第二次确认，再放大头寸规模。`,
    ].join("");
    keyPoints = [
      "超卖区域出现放量杀跌，典型投降式抛售特征",
      "反身性下行进入末端，风险收益比转向多头",
      "先建观察仓，等待企稳信号确认后加仓",
    ];
  } else if (vol > 60) {
    signal = "neutral";
    confidence = 45;
    reasoning = [
      `年化波动率飙升至${fmt(vol, 1)}%，市场正在经历剧烈再定价，多空反身性相互厮杀。`,
      `在这种剧烈波动的环境中，反身性方向尚未确立，任何单边头寸都面临被双向绞杀的风险。`,
      `我的首要原则是先活下来——不押注方向，不与市场对抗。`,
      `降低仓位、保留弹药，等待波动率收敛后反身性趋势再次清晰时再出手。`,
    ].join("");
    keyPoints = [
      "波动率飙升超六成，市场进入剧烈再定价阶段",
      "反身性方向不明，双向绞杀风险显著上升",
      "减仓观望优先求存，等待波动收敛后再入场",
    ];
  }

  return {
    signal,
    confidence,
    reasoning,
    keyPoints,
    keyMetrics: {
      rsi: rsi ?? "N/A",
      momentum1mPct: momentum,
      volumeRatio: volRatio,
      annualizedVolatilityPct: vol,
      sentiment: sentiment?.overallSentiment ?? "N/A",
    },
  };
}

function buildUserPrompt(params: SorosParams): string {
  const { symbol, currentPrice, technicals, fundamentals, sentiment } = params;
  const t = technicals;
  const f = fundamentals ?? {};
  return [
    `股票代码: ${symbol}`,
    `当前价格: HKD ${fmt(currentPrice, 2)}`,
    ``,
    `【反身性观察指标】`,
    `- RSI(14): ${fmt(t.rsi14 ?? t.rsi, 1)}`,
    `- 近1月动量: ${fmt((t.momentum1m ?? 0) * 100, 1)}%`,
    `- 近3月动量: ${fmt((t.momentum3m ?? 0) * 100, 1)}%`,
    `- 量比(vs 20日均量): ${fmt(t.volumeRatio, 2)}`,
    `- 年化波动率: ${fmt((t.annualizedVolatility ?? t.volatility20d ?? 0) * 100, 1)}%`,
    `- ATR%: ${fmt(t.atrPct, 2)}`,
    `- 布林位置 (0-1): ${fmt(t.priceVsBb, 2)}`,
    `- ADX(14): ${fmt(t.adx14, 1)}`,
    `- MACD柱: ${fmt(t.macdHist, 4)}`,
    `- 偏度 skew20: ${fmt(t.skew20, 2)}`,
    ``,
    `【估值/基本面参考】`,
    `- P/E: ${fmt(f.pe, 2)}, P/B: ${fmt(f.pb, 2)}`,
    ``,
    `【情绪】`,
    `- ${sentiment?.overallSentiment ?? "无"}`,
    ``,
    `请从反身性/繁荣-萧条视角给出 bullish/bearish/neutral，用简体中文，指出你看到的关键证据，返回 JSON。`,
  ].join("\n");
}

export async function analyzeSoros(params: SorosParams): Promise<AgentAnalysisResult> {
  const startedAt = Date.now();
  const ai = params.aiService ?? createDoubaoService();
  const fallback = sorosFallback(params.technicals, params.sentiment);

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
      temperature: 0.3,
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
async function run(params: SorosParams | Record<string, unknown>) {
  const p = params as SorosParams;
  const result = await analyzeSoros(p);
  return toAnalystSignal(MASTER_NAME, result.signal, result.mode, result.fallbackReason);
}

export default run;
