import type {
  AgentAnalysisResult,
  MasterSignal,
  FundamentalMetrics,
  TechnicalIndicators,
} from "@/lib/types";
import { createDoubaoService } from "@/lib/server/ai-service";
import { signalSchema, normalizeSignal, fmt, toAnalystSignal } from "./shared";

const MASTER_ID = "livermore" as const;
const MASTER_NAME = "杰西·利弗莫尔";

const SYSTEM_PROMPT = `You are Jesse Livermore, the legendary stock speculator known for reading tape action and pivotal points. Decide bullish, bearish, or neutral based on price action and timing.

Core principles:
1. Pivotal Points: Buy on breakouts above resistance, sell on breakdowns below support
2. Volume confirms price: Volume must expand on breakouts, shrink on pullbacks
3. The trend is your friend - don't fight the tape
4. Cut losses quickly (never average down in a losing position)
5. Pyramid into winning positions, not losers
6. Wait for the perfect setup - patience pays
7. Markets are never wrong; opinions often are

Signal rules:
- Bullish: Price breaks above resistance (above EMA21/55) with expanding volume (>1.2x avg), ADX > 25 confirming trend, MACD bullish crossover
- Bearish: Price breaks below support (below key EMAs), volume expansion on decline, ADX strong, MACD bearish
- Neutral: No clear breakout/breakdown, choppy sideways action, wait for pivotal point

Confidence scale:
- 80-100%: Clean breakout/breakdown with multiple confirming signals (volume + ADX + MACD alignment)
- 60-79%: Good setup with some confirming signals
- 40-59%: Mixed signals, not a clean Livermore setup
- 20-39%: Against the tape, counter-trend
- 0-19%: Clear trap/failed breakout

Key metrics: EMA crossovers (8/21/55), Bollinger Band position, ADX strength, volume ratio, MACD, ATR.
Reason in Livermore's decisive speculator voice - short, punchy, tape-focused. Mention "pivotal point" and "the tape says". All reasoning in Simplified Chinese (简体中文).
Return JSON only.`;

export interface LivermoreParams {
  symbol: string;
  currentPrice: number;
  technicals: TechnicalIndicators;
  fundamentals?: FundamentalMetrics;
  sentiment?: { overallSentiment?: string };
  aiService?: ReturnType<typeof createDoubaoService>;
}

/**
 * Livermore 纯技术 fallback：
 * - price>EMA21 AND price>EMA55 AND EMA8>EMA21 AND volumeRatio>1.2 AND ADX>25 → bullish
 * - price<EMA21 AND price<EMA55 AND EMA8<EMA21 AND volumeRatio>1.2 AND ADX>25 → bearish
 * - RSI>80 → bearish (超买)
 * - RSI<20 且放量 → bullish (恐慌底)
 * - 否则 neutral
 */
export function livermoreFallback(currentPrice: number, technicals: TechnicalIndicators): MasterSignal {
  const t = technicals;
  const ema8 = t.ema8 ?? t.ma5;
  const ema21 = t.ema21 ?? t.ma20;
  const ema55 = t.ema55 ?? t.ma50;
  const rsi = t.rsi14 ?? t.rsi;
  const adx = t.adx14;
  const vr = t.volumeRatio ?? 1;
  const macdHist = t.macdHist;
  const atrPct = (t.atrPct ?? 0) * 100;
  const priceVsBb = t.priceVsBb;

  let signal: MasterSignal["signal"] = "neutral";
  let confidence = 50;
  let reasoning = "盘口没有明确信号，既没突破也没破位——耐心等待关键点，不要硬做。";
  let keyPoints: string[] = [
    "价格在均线附近震荡，未出现明确关键点信号",
    "量能温和缺乏爆发，盘口尚未表态方向",
    "保持sitting耐心持币，等待真正的突破/破位",
  ];

  const above21 = ema21 !== undefined && currentPrice > ema21;
  const above55 = ema55 !== undefined && currentPrice > ema55;
  const emaBull = ema8 !== undefined && ema21 !== undefined && ema8 > ema21;
  const emaBear = ema8 !== undefined && ema21 !== undefined && ema8 < ema21;
  const volExp = vr > 1.2;
  const strongTrend = adx !== undefined && adx > 25;
  const macdBull = macdHist !== undefined && macdHist > 0;
  const macdBear = macdHist !== undefined && macdHist < 0;

  const breakout = above21 && above55 && emaBull && volExp && strongTrend && macdBull;
  const breakdown = !above21 && !above55 && emaBear && volExp && strongTrend && macdBear;

  if (breakout) {
    signal = "bullish";
    confidence = 85;
    reasoning = [
      `盘口告诉我的一切都在齐声喊多：股价 ${fmt(currentPrice, 2)} 一举站上 EMA21（${fmt(ema21, 2)}）与 EMA55（${fmt(ema55, 2)}）两大关键均线，这是教科书级别的关键点向上突破。`,
      `EMA8 已上穿 EMA21 形成多头排列，短期趋势完成扭转，不是反弹而是反转的盘口语言。`,
      `成交量给出明确确认：量比 ${fmt(vr, 2)} 显著放大，突破有真金白银跟随，不是虚晃一枪的假动作。`,
      `ADX ${fmt(adx, 0)} 说明趋势强度足够，MACD 柱翻红（${fmt(macdHist, 4)}）印证动能同步释放。`,
      `这是我等待已久的时刻——不要犹豫，先建首仓，之后每一次回踩关键点若不破，我就金字塔加码。止损严格设在突破点下方约 ${fmt(atrPct * 1.5, 1)}% 处，市场永远是对的，但错了必须立刻认错。`,
    ].join("");
    keyPoints = [
      "价格放量突破EMA21/55双均线，关键点位确认",
      "量比放大配合ADX走强，MACD金叉共振",
      "顺势建立多头并金字塔加仓，严守突破点止损",
    ];
  } else if (breakdown) {
    signal = "bearish";
    confidence = 85;
    reasoning = [
      `盘口清晰地转向空头：股价 ${fmt(currentPrice, 2)} 已经跌破 EMA21（${fmt(ema21, 2)}）与 EMA55（${fmt(ema55, 2)}）两道重要防线，关键点向下击穿，多头趋势正式完结。`,
      `EMA8 下穿 EMA21 形成死叉，短中长期均线全部掉头向下，盘口结构已经坏掉。`,
      `放量下杀，量比高达 ${fmt(vr, 2)}，这不是散户卖出，是主力资金在真正撤退，空方有了成交量的背书。`,
      `ADX ${fmt(adx, 0)} 趋势强度不弱，MACD 柱翻绿（${fmt(macdHist, 4)}），动能正在向空头加速释放。`,
      `盘口说离场甚至做空——绝不逆势抄底，我会建立空头头寸并把止损设在破位点之上。我在1929年学到的教训：趋势形成时不要对抗它。`,
    ].join("");
    keyPoints = [
      "价格放量跌破EMA21/55双均线，空头关键点确立",
      "量价齐跌配合ADX走弱反转，MACD死叉共振",
      "顺势建立空头，禁止摊平亏损，严格设好止损",
    ];
  } else if (rsi !== undefined && rsi > 80) {
    signal = "bearish";
    confidence = 65;
    reasoning = [
      `RSI 已经冲到 ${fmt(rsi, 0)}，进入严重超买区域，盘口在发出明确的警告。`,
      `虽然价格看起来还在涨，但投机潮已经过热，大众疯狂时往往是顶部临近的征兆。`,
      `这时候追高就像在飞驰的火车前捡硬币——利润有限，风险无限。`,
      `我不会立刻做空（趋势尚未破位），但会收紧多头止损，绝不追加头寸，一旦出现向下关键点立刻翻空。`,
      `记住，赚大钱靠的不是想法，而是sitting——持币等待比追涨需要更大的耐心。`,
    ].join("");
    keyPoints = [
      "RSI突破80严重超买，追高风险收益比极差",
      "趋势未破但情绪过热，警惕多头动能衰竭",
      "收紧多头止损不追涨，等待向下关键点确认",
    ];
  } else if (rsi !== undefined && rsi < 20 && vr > 1.3) {
    signal = "bullish";
    confidence = 65;
    reasoning = [
      `RSI 跌到 ${fmt(rsi, 0)} 的极度超卖区，量比 ${fmt(vr, 2)} 明显放大，盘口出现了恐慌性抛售的特征。`,
      `这种放量急跌常常是最后的弱者被震出场的时刻，历史上我见过无数次这样的"洗盘底"。`,
      `但我从来不抄底——左侧交易是新手的坟墓，我只做右侧。`,
      `这只股票进入我的密切观察名单，一旦价格止跌、缩量回踩后再次放量向上突破关键点，我会第一时间做多。`,
      `止损设在恐慌低点下方，永远先想亏多少，再想赚多少。`,
    ].join("");
    keyPoints = [
      "RSI跌破20极度超卖叠加放量，恐慌抛盘涌现",
      "不做左侧抄底，等待右侧关键点向上确认",
      "纳入密切观察名单，底部确认后顺势做多",
    ];
  } else if (above21 && above55 && emaBull && !volExp) {
    signal = "neutral";
    confidence = 45;
    reasoning = [
      `多头趋势结构还在：价格仍在 EMA21/55 之上，EMA8 也在 EMA21 之上，整体盘口偏多没有被破坏。`,
      `但问题出在量能——量比仅 ${fmt(vr, 2)}，没有新资金涌入的上涨更像是惯性飘移，而非趋势加速。`,
      `没有新的关键点信号出现，既不到加仓的位置，也没到清仓的时刻。`,
      `这种市况下，持有的单子可以继续sitting，但绝不追加新仓位。`,
      `把止损上移到最近的整理低点，锁定已有利润，让市场自己告诉我下一步往哪走。`,
    ].join("");
    keyPoints = [
      "多头趋势结构保持，但量能萎缩缺乏新增资金",
      "无新增关键点信号，不追加多头也不清仓",
      "上移止损锁定利润，sitting持有等待新信号",
    ];
  } else if (!above21 && !above55 && emaBear) {
    signal = "bearish";
    confidence = 60;
    reasoning = [
      `盘口结构偏空：股价 ${fmt(currentPrice, 2)} 已运行在 EMA21（${fmt(ema21, 2)}）和 EMA55（${fmt(ema55, 2)}）这两条主要均线下方，EMA8 也压在 EMA21 之下。`,
      `均线像一堵墙一样压制着价格——每次反弹到均线附近都会遇到抛压，这就是空头趋势的特征。`,
      `我从不逆势抄底，在关键点没有明确向上突破之前，任何买入都是在和盘口对抗，而盘口永远不会错。`,
      `继续等待真正的反转关键点——放量站上EMA21且EMA8上穿，那才是sitting结束的时刻。`,
      `现在能做的最好的交易就是不交易，耐心是投机者最宝贵的美德。`,
    ].join("");
    keyPoints = [
      "价格运行在EMA21/55下方且空头排列，趋势偏空",
      "均线压制下反弹即遇抛压，禁止逆势抄底",
      "耐心等待放量站上均线的反转关键点再入场",
    ];
  }

  return {
    signal,
    confidence,
    reasoning,
    keyPoints,
    keyMetrics: {
      price: currentPrice,
      ema8: ema8 ?? "N/A",
      ema21: ema21 ?? "N/A",
      ema55: ema55 ?? "N/A",
      rsi: rsi ?? "N/A",
      adx: adx ?? "N/A",
      volumeRatio: vr,
      macdHist: macdHist ?? "N/A",
      bbPosition: priceVsBb ?? "N/A",
      atrPct,
    },
  };
}

function buildUserPrompt(params: LivermoreParams): string {
  const { symbol, currentPrice, technicals } = params;
  const t = technicals;
  return [
    `股票代码: ${symbol}`,
    `当前价格: HKD ${fmt(currentPrice, 2)}`,
    ``,
    `【盘口/关键点】`,
    `- EMA8: ${fmt(t.ema8 ?? t.ma5, 3)}`,
    `- EMA21: ${fmt(t.ema21 ?? t.ma20, 3)}`,
    `- EMA55: ${fmt(t.ema55 ?? t.ma50, 3)}`,
    `- MA5/20/50: ${fmt(t.ma5, 3)} / ${fmt(t.ma20, 3)} / ${fmt(t.ma50, 3)}`,
    `- MACD / Signal / Hist: ${fmt(t.macd, 4)} / ${fmt(t.macdSignal, 4)} / ${fmt(t.macdHist, 4)}`,
    `- ADX(14): ${fmt(t.adx14, 1)}`,
    `- RSI(14): ${fmt(t.rsi14 ?? t.rsi, 1)}`,
    `- 布林上/中/下: ${fmt(t.bollingerUpper, 3)} / ${fmt(t.bollingerMiddle, 3)} / ${fmt(t.bollingerLower, 3)}`,
    `- 布林宽度: ${fmt((t.bbWidth ?? 0) * 100, 2)}%`,
    `- 价格在布林带位置 (0-1): ${fmt(t.priceVsBb, 2)}`,
    `- ATR(14): ${fmt(t.atr14 ?? t.atr, 3)} (ATR%: ${fmt((t.atrPct ?? 0) * 100, 2)}%)`,
    `- 量比(vs 20日均量): ${fmt(t.volumeRatio, 2)}`,
    `- 近1月动量: ${fmt((t.momentum1m ?? 0) * 100, 1)}%`,
    `- 近3月动量: ${fmt((t.momentum3m ?? 0) * 100, 1)}%`,
    `- 年化波动率: ${fmt((t.annualizedVolatility ?? t.volatility20d ?? 0) * 100, 1)}%`,
    ``,
    `请以 Jesse Livermore 的投机视角（关键点、突破/破位确认、量价配合、顺势而为）给出 bullish/bearish/neutral，简体中文，返回 JSON。`,
  ].join("\n");
}

export async function analyzeLivermore(params: LivermoreParams): Promise<AgentAnalysisResult> {
  const startedAt = Date.now();
  const ai = params.aiService ?? createDoubaoService();
  const fallback = livermoreFallback(params.currentPrice, params.technicals);

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
async function run(params: LivermoreParams | Record<string, unknown>) {
  const p = params as LivermoreParams;
  const result = await analyzeLivermore(p);
  return toAnalystSignal(MASTER_NAME, result.signal, result.mode, result.fallbackReason);
}

export default run;
