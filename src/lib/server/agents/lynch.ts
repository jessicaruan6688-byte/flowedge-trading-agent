import type {
  AgentAnalysisResult,
  MasterSignal,
  FundamentalMetrics,
  TechnicalIndicators,
} from "@/lib/types";
import { createDoubaoService } from "@/lib/server/ai-service";
import { signalSchema, normalizeSignal, fmt, toAnalystSignal } from "./shared";

const MASTER_ID = "lynch" as const;
const MASTER_NAME = "彼得·林奇";

const SYSTEM_PROMPT = `You are a Peter Lynch AI agent. You make investment decisions based on Peter Lynch's well-known principles:

1. Invest in What You Know: Emphasize understandable businesses you can explain simply
2. Growth at a Reasonable Price (GARP): Rely on the PEG ratio as a prime metric
3. Look for 'Ten-Baggers': Companies capable of growing earnings and share price substantially
4. Steady Growth: Prefer consistent revenue/earnings expansion, less concern about short-term noise
5. Avoid High Debt: Watch for dangerous leverage
6. The story matters: A good, simple 'story' behind the stock, but not overhyped or too complex

When you provide your reasoning, do it in Peter Lynch's voice:
- Cite the PEG ratio if data is available
- Mention 'ten-bagger' potential if applicable
- Refer to practical observations (e.g., "If the business model is simple enough for a child to understand...")
- Use practical, folksy language
- Provide key positives and negatives
- Conclude with a clear stance (bullish, bearish, or neutral)

For Hong Kong stocks: consider that Chinese tech conglomerates, consumer brands, and property companies are your playground. Look for undervalued growth stories.
All reasoning text in Simplified Chinese (简体中文). Return JSON only with signal, confidence, reasoning.`;

export interface LynchParams {
  symbol: string;
  currentPrice: number;
  technicals: TechnicalIndicators;
  fundamentals?: FundamentalMetrics;
  sentiment?: { overallSentiment?: string };
  aiService?: ReturnType<typeof createDoubaoService>;
}

/**
 * Lynch GARP fallback：
 * - 盈利增长 > 15% AND PE < 20 → bullish
 * - PEG < 1 → bullish
 * - D/E > 1.5 → bearish
 * - 增长为负 OR PE > 40 → bearish
 * - 否则 neutral
 */
export function lynchFallback(fundamentals?: FundamentalMetrics, technicals?: TechnicalIndicators): MasterSignal {
  const f = fundamentals ?? {};
  const g = (typeof f.earningsGrowth === "number" ? f.earningsGrowth : f.revenueGrowth) ?? 0; // %
  const pe = typeof f.pe === "number" && f.pe > 0 ? f.pe : undefined;
  const peg = pe !== undefined && g > 0 ? pe / g : undefined; // 注意：g 是百分比数字
  const de = f.debtToEquity;

  let signal: MasterSignal["signal"] = "neutral";
  let confidence = 55;
  let reasoning = "故事还不够清晰，增长与估值不太匹配——我再到商场里多转转，看看这家公司到底在干什么。";
  let keyPoints: string[] = [
    "增长与估值信号混合，故事尚未完全成型",
    "PEG不够有吸引力，十倍股特征暂不明显",
    "加入观察名单，继续在生活中调研公司",
  ];

  const bullGrowth = g > 15 && pe !== undefined && pe < 20;
  const bullPeg = peg !== undefined && peg < 1 && peg > 0;
  const bearDebt = de !== undefined && de > 1.5;
  const bearExpensive = pe !== undefined && pe > 40;
  const bearDecline = g < 0;

  const bullCount = [bullGrowth, bullPeg].filter(Boolean).length;
  const bearCount = [bearDebt, bearExpensive, bearDecline].filter(Boolean).length;

  if (bullCount > 0 && bearCount === 0) {
    signal = "bullish";
    confidence = 65 + bullCount * 10;
    const tenBaggerHint = g > 25 && pe !== undefined && pe < 25
      ? `盈利增速${fmt(g, 1)}%配上P/E ${fmt(pe, 1)}倍，这种组合我在历史上见过几只 ten-bagger（十倍股）。`
      : `增速${fmt(g, 1)}%虽然不算爆炸，但可持续性比爆发力更重要。`;
    reasoning = [
      `让我先算账：P/E ${fmt(pe, 1)}倍，盈利增速${fmt(g, 1)}%，算下来PEG ${peg !== undefined ? fmt(peg, 2) : "N/A"}，低于1意味着"增长免费送"，这是典型的GARP甜点。`,
      `${tenBaggerHint}`,
      `业务模式我能在三分钟内向小孩讲明白，这说明故事足够简单，不在我能力圈之外。`,
      `资产负债表也干净，D/E ${fmt(de, 2)}不会让我在夜里被电话惊醒——不会因为债务暴雷毁掉一个好故事。`,
      `我在商场和街头能实实在在感受到这家公司的产品或服务，这才是我敢下重注的ten-bagger苗子。`,
    ].join("");
    keyPoints = [
      "PEG低于1，GARP框架下估值与成长匹配度极佳",
      "业务简单易懂，能力圈之内能讲清增长故事",
      "负债水平健康，具备潜在ten-bagger十倍股基因",
    ];
  } else if (bearCount > 0 && bullCount === 0) {
    signal = "bearish";
    confidence = 65 + bearCount * 8;
    const reasons: string[] = [];
    if (bearDebt) reasons.push(`D/E ${fmt(de, 2)}`);
    if (bearExpensive) reasons.push(`P/E ${fmt(pe, 1)}倍`);
    if (bearDecline) reasons.push(`盈利增长${fmt(g, 1)}%`);
    reasoning = [
      `让我数一下红灯：${reasons.join("、")}——这几项指标放在一起，就像餐厅里闻到了不新鲜的味道。`,
      bearDebt ? `负债太重，一旦行业逆风，公司拿什么继续扩张？高负债是ten-bagger的天敌。` : `估值端${pe !== undefined ? `P/E ${fmt(pe, 1)}倍` : "明显偏贵"}，市场把未来三五年的增长都提前透支了，一旦业绩不及预期，戴维斯双杀就在所难免。`,
      bearDecline ? `更糟的是盈利在下滑——一家连增长都做不到的公司，再便宜都不是GARP，那是价值陷阱。` : `增长端也没看到亮眼的数字，故事讲不圆。`,
      `这种公司要么是华尔街讲过头的热门股，要么是资产负债表里埋着我不想挖的雷。`,
      `我宁愿错过一个可能的机会，也不愿意踩到一颗真正的雷——放弃它，继续去商场里找下一个好故事。`,
    ].join("");
    keyPoints = [
      "PEG偏高或增长失速，GARP框架下缺乏安全边际",
      "高负债或估值透支，戴维斯双杀风险显著上升",
      "故事复杂或难以在生活中验证，回避价值陷阱",
    ];
  } else {
    signal = "neutral";
    confidence = 55;
    reasoning = [
      `说实话这家公司让我有点犹豫：P/E ${fmt(pe, 1)}倍、盈利增速${fmt(g, 1)}%，PEG ${peg !== undefined ? fmt(peg, 2) : "N/A"}，不便宜也不贵。`,
      `好的一面是业务我大致看得懂，坏消息是故事只讲了一半——增长有，但还不够激动人心；估值合理，但也没便宜到让我想跳起来买。`,
      `D/E ${fmt(de, 2)}不算吓人，但也谈不上教科书般干净。`,
      `这种股票最让人犯困：涨的时候不惊艳，跌的时候也不含糊——典型的"等一等再说"。`,
      `我会把它放进我的"持续跟踪清单"，每个季度翻一遍财报，也继续在商场和生活里观察它的产品，等故事更清晰时再决定是加码还是放手。`,
    ].join("");
    keyPoints = [
      "PEG接近1估值合理，但缺乏显著的GARP折让",
      "业务可理解但故事未完全打动，缺乏十倍股特质",
      "放入观察名单，等待季度数据与生活验证信号",
    ];
  }

  return {
    signal,
    confidence: Math.max(0, Math.min(100, confidence)),
    reasoning,
    keyPoints,
    keyMetrics: {
      pe: pe ?? "N/A",
      earningsGrowthPct: g,
      peg: peg ?? "N/A",
      debtToEquity: de ?? "N/A",
      momentum1mPct: (technicals?.momentum1m ?? 0) * 100,
    },
  };
}

function buildUserPrompt(params: LynchParams): string {
  const { symbol, currentPrice, technicals, fundamentals, sentiment } = params;
  const f = fundamentals ?? {};
  const g = (f.earningsGrowth ?? f.revenueGrowth) ?? 0;
  const peg = typeof f.pe === "number" && f.pe > 0 && g > 0 ? f.pe / g : undefined;
  return [
    `股票代码: ${symbol}`,
    `当前价格: HKD ${fmt(currentPrice, 2)}`,
    ``,
    `【增长故事（GARP）】`,
    `- 市盈率 P/E: ${fmt(f.pe, 2)}`,
    `- 营收增长: ${fmt(f.revenueGrowth, 1)}%`,
    `- 盈利增长: ${fmt(f.earningsGrowth, 1)}%`,
    `- PEG (PE / 盈利增长%): ${fmt(peg, 2)}`,
    `- EPS: ${fmt(f.eps, 3)}`,
    `- 自由现金流: ${f.freeCashFlow ?? "N/A"}`,
    ``,
    `【资产负债】`,
    `- D/E: ${fmt(f.debtToEquity, 2)}`,
    `- 营业利润率: ${fmt(f.operatingMargin, 1)}%`,
    `- 流动比率: ${fmt(f.currentRatio, 2)}`,
    `- ROE: ${fmt(f.roe, 1)}%`,
    ``,
    `【市场/技术】`,
    `- RSI: ${fmt(technicals.rsi14 ?? technicals.rsi, 1)}`,
    `- 近1月动量: ${fmt((technicals.momentum1m ?? 0) * 100, 1)}%`,
    `- 量比: ${fmt(technicals.volumeRatio, 2)}`,
    ``,
    `【行业/情绪】`,
    `- 行业: ${f.sector ?? "N/A"}`,
    `- 公司: ${f.companyName ?? "N/A"}`,
    `- 情绪: ${sentiment?.overallSentiment ?? "无"}`,
    ``,
    `请以 Peter Lynch 的风格（GARP/十倍股/懂的生意/回避高负债）给出 bullish/bearish/neutral，简体中文，返回 JSON。`,
  ].join("\n");
}

export async function analyzeLynch(params: LynchParams): Promise<AgentAnalysisResult> {
  const startedAt = Date.now();
  const ai = params.aiService ?? createDoubaoService();
  const fallback = lynchFallback(params.fundamentals, params.technicals);

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
async function run(params: LynchParams | Record<string, unknown>) {
  const p = params as LynchParams;
  const result = await analyzeLynch(p);
  return toAnalystSignal(MASTER_NAME, result.signal, result.mode, result.fallbackReason);
}

export default run;
