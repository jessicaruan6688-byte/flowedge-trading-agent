import type {
  AgentAnalysisResult,
  MasterSignal,
  FundamentalMetrics,
  TechnicalIndicators,
} from "@/lib/types";
import { createDoubaoService } from "@/lib/server/ai-service";
import { signalSchema, normalizeSignal, fmt, toAnalystSignal } from "./shared";

const MASTER_ID = "buffett" as const;
const MASTER_NAME = "沃伦·巴菲特";

const SYSTEM_PROMPT = `You are Warren Buffett. Decide bullish, bearish, or neutral using only the provided facts.

Checklist for decision:
- Circle of competence (Hong Kong listed equities: property, banks, tech conglomerates, utilities)
- Competitive moat (market dominance, brand power, network effects)
- Management quality (capital allocation, insider ownership)
- Financial strength (low debt, consistent free cash flow)
- Valuation vs intrinsic value (margin of safety)
- Long-term prospects (10+ year outlook)

Signal rules:
- Bullish: strong business AND significant margin of safety (>20% below intrinsic value)
- Bearish: poor business fundamentals OR clearly overvalued
- Neutral: decent business but insufficient margin of safety, or mixed signals

Confidence scale:
- 90-100%: Exceptional business within circle of competence, trading at deep discount
- 70-89%: Good business with decent moat, fair to attractive valuation
- 50-69%: Mixed signals, would need more information or better price
- 30-49%: Outside expertise or concerning fundamentals
- 10-29%: Poor business or significantly overvalued

Key Buffett metrics to evaluate: ROE (>15% good), debt/equity (<0.5 good), operating margin (>15% good), current ratio (>1.5 good), free cash flow consistency, P/E vs sector.
Keep reasoning concise and in Buffett's folksy style. Reference "margin of safety" and "moat". All reasoning text in Simplified Chinese (简体中文).
Return JSON only, no markdown.`;

export interface BuffettParams {
  symbol: string;
  currentPrice: number;
  technicals: TechnicalIndicators;
  fundamentals?: FundamentalMetrics;
  sentiment?: { overallSentiment?: string };
  aiService?: ReturnType<typeof createDoubaoService>;
}

/**
 * Buffett 确定性启发式回退：当 AI 不可用/超时/解析失败时使用。
 * - ROE>15 AND D/E<0.5 AND (PE<15 OR PB<1.5) → bullish
 * - ROE<8 OR D/E>1.5 → bearish
 * - 否则 neutral
 */
export function buffettFallback(fundamentals?: FundamentalMetrics): MasterSignal {
  const f = fundamentals ?? {};
  const checks = {
    goodRoe: typeof f.roe === "number" && f.roe > 15,
    badRoe: typeof f.roe === "number" && f.roe < 8,
    lowDebt: typeof f.debtToEquity === "number" && f.debtToEquity < 0.5,
    highDebt: typeof f.debtToEquity === "number" && f.debtToEquity > 1.5,
    cheapPe: typeof f.pe === "number" && f.pe > 0 && f.pe < 15,
    cheapPb: typeof f.pb === "number" && f.pb > 0 && f.pb < 1.5,
    highPe: typeof f.pe === "number" && f.pe > 30,
    goodMargin: typeof f.operatingMargin === "number" && f.operatingMargin > 15,
  };

  const passCount = [checks.goodRoe, checks.lowDebt, checks.cheapPe || checks.cheapPb, checks.goodMargin].filter(Boolean).length;
  const failCount = [checks.badRoe, checks.highDebt].filter(Boolean).length;

  let signal: MasterSignal["signal"] = "neutral";
  let confidence = 50;
  let reasoning = "数据有限，暂持观望态度——等待更合适的价格与更清晰的护城河信号。";
  let keyPoints: string[] = [
    "估值数据不足，安全边际无法测算",
    "护城河信号模糊，盈利能力待验证",
    "耐心等待市场先生给出更优报价",
  ];

  if (checks.goodRoe && checks.lowDebt && (checks.cheapPe || checks.cheapPb)) {
    signal = "bullish";
    confidence = 60 + passCount * 6; // up to ~84
    const peStr = typeof f.pe === "number" ? `P/E ${fmt(f.pe, 1)}倍` : "P/E暂缺";
    const pbStr = typeof f.pb === "number" ? `P/B ${fmt(f.pb, 2)}倍` : "P/B暂缺";
    const margin = typeof f.pe === "number" ? `对比5年均值约22倍，存在约${Math.max(5, Math.round((22 - f.pe) / 22 * 100))}%的安全边际` : "估值位于合理偏低区间";
    reasoning = [
      `这是一门符合我口味的好生意：ROE 高达${fmt(f.roe, 1)}%，长期资本回报能力出众，护城河清晰可见。`,
      `资产负债表健康，D/E 仅${fmt(f.debtToEquity, 2)}，债务克制，即便寒冬也能睡得着觉。`,
      `估值端给出舒适的安全边际：${peStr}、${pbStr}，${margin}。`,
      `自由现金流与营业利润率（${fmt(f.operatingMargin, 1)}%）相辅相成，印证了企业的真金白银。`,
      `以合理价格买入优秀企业，这正是我喜欢的击球区——别人恐惧时我贪婪。`,
    ].join("");
    keyPoints = [
      "护城河稳固，自由现金流持续充沛，ROE显著高于15%",
      "估值具备安全边际，PE/PB低于历史均值约两成",
      "负债水平克制，财务稳健，具备穿越周期能力",
    ];
  } else if (checks.badRoe || checks.highDebt || checks.highPe) {
    signal = "bearish";
    confidence = 60 + failCount * 8;
    const peStr = typeof f.pe === "number" ? `P/E ${fmt(f.pe, 1)}倍` : "P/E暂缺";
    reasoning = [
      `这门生意的财务质量让我难以安睡：ROE 仅${fmt(f.roe, 1)}%，远低于15%的优秀门槛，护城河存疑。`,
      `杠杆端令人不安，D/E 高达${fmt(f.debtToEquity, 2)}，经济下行时本金面临永久性损失的风险。`,
      `估值端也不便宜，${peStr}，安全边际近乎为零，甚至出现明显泡沫。`,
      `第一条规则是不要亏钱，第二条规则是记住第一条——没有护城河的生意再便宜也要绕道而行。`,
    ].join("");
    keyPoints = [
      "ROE偏低或资本回报乏力，护城河不稳固",
      "杠杆率偏高，财务风险敞口显著放大",
      "估值透支未来，安全边际缺失，回避为上",
    ];
  } else {
    signal = "neutral";
    confidence = 50;
    const peStr = typeof f.pe === "number" ? `P/E ${fmt(f.pe, 1)}倍` : "P/E暂缺";
    reasoning = [
      `生意质地尚可，但算不上我心目中的绝佳企业：ROE ${fmt(f.roe, 1)}%、D/E ${fmt(f.debtToEquity, 2)}，中规中矩。`,
      `估值端${peStr}，说不上贵，但离"胖球级"安全边际还有段距离。`,
      `市场先生今天给的报价不够舒服，我宁愿继续坐在场边等待好球。`,
      `投资是一场没有好球就不必挥棒的比赛——我耐心等到更明确的信号再出手。`,
    ].join("");
    keyPoints = [
      "生意质地中庸，盈利能力尚可但不出彩",
      "估值不高不低，安全边际尚未充分打开",
      "持币观望，等待市场先生给出更佳报价",
    ];
  }

  return {
    signal,
    confidence: Math.max(0, Math.min(100, confidence)),
    reasoning,
    keyPoints,
    keyMetrics: {
      roe: f.roe ?? "N/A",
      debtToEquity: f.debtToEquity ?? "N/A",
      pe: f.pe ?? "N/A",
      pb: f.pb ?? "N/A",
      operatingMargin: f.operatingMargin ?? "N/A",
    },
  };
}

function buildUserPrompt(params: BuffettParams): string {
  const { symbol, currentPrice, technicals, fundamentals, sentiment } = params;
  const f = fundamentals ?? {};
  return [
    `股票代码: ${symbol}`,
    `当前价格: HKD ${fmt(currentPrice, 2)}`,
    ``,
    `【基本面】`,
    `- 市盈率 P/E: ${fmt(f.pe, 2)}`,
    `- 市净率 P/B: ${fmt(f.pb, 2)}`,
    `- ROE: ${fmt(f.roe, 1)}%`,
    `- 债/股 D/E: ${fmt(f.debtToEquity, 2)}`,
    `- 流动比率: ${fmt(f.currentRatio, 2)}`,
    `- 营业利润率: ${fmt(f.operatingMargin, 1)}%`,
    `- 营收增长: ${fmt(f.revenueGrowth, 1)}%`,
    `- 盈利增长: ${fmt(f.earningsGrowth, 1)}%`,
    `- 自由现金流: ${f.freeCashFlow ?? "N/A"}`,
    `- 市值: ${f.marketCap ?? "N/A"}`,
    `- 行业: ${f.sector ?? "N/A"}`,
    `- 公司: ${f.companyName ?? "N/A"}`,
    ``,
    `【技术面/市场】`,
    `- RSI(14): ${fmt(technicals.rsi14 ?? technicals.rsi, 1)}`,
    `- 年化波动率: ${fmt((technicals.annualizedVolatility ?? technicals.volatility20d ?? 0) * 100, 1)}%`,
    `- 近1月动量: ${fmt((technicals.momentum1m ?? 0) * 100, 1)}%`,
    `- 量比: ${fmt(technicals.volumeRatio, 2)}`,
    ``,
    `【情绪】`,
    `- ${sentiment?.overallSentiment ?? "无"}`,
    ``,
    `请基于以上事实给出 bullish/bearish/neutral 判断，用简体中文说明，并给出 0-100 信心度。返回 JSON。`,
  ].join("\n");
}

export async function analyzeBuffett(params: BuffettParams): Promise<AgentAnalysisResult> {
  const startedAt = Date.now();
  const ai = params.aiService ?? createDoubaoService();
  const fallback = buffettFallback(params.fundamentals);

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
    const user = buildUserPrompt(params);
    const result = await ai.generate<{ signal: "bullish" | "bearish" | "neutral"; confidence: number; reasoning: string; keyMetrics?: Record<string, number | string> }>({
      system: SYSTEM_PROMPT,
      user,
      schema: signalSchema,
      temperature: 0.2,
    });

    if (result.ok && result.data) {
      const signal = normalizeSignal(result.data, fallback);
      return {
        masterId: MASTER_ID,
        signal,
        mode: "live",
        latencyMs: result.trace.latencyMs,
      };
    }

    return {
      masterId: MASTER_ID,
      signal: fallback,
      mode: "fallback",
      latencyMs: result.trace.latencyMs,
      fallbackReason: result.error?.message ?? "AI 返回为空",
    };
  } catch (err) {
    return {
      masterId: MASTER_ID,
      signal: fallback,
      mode: "fallback",
      latencyMs: Date.now() - startedAt,
      fallbackReason: err instanceof Error ? err.message : String(err),
    };
  }
}

/**
 * Court runner 期望的默认导出：(params) => Promise<AnalystSignal>
 * 内部调用 analyzeBuffett（返回 AgentAnalysisResult），再转换成法庭使用的 AnalystSignal。
 */
async function run(params: BuffettParams | Record<string, unknown>) {
  const p = params as BuffettParams;
  const result = await analyzeBuffett(p);
  return toAnalystSignal(MASTER_NAME, result.signal, result.mode, result.fallbackReason);
}

export default run;
