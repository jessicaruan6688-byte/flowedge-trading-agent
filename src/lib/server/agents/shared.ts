import type { AnalystSignal, MasterSignal } from "@/lib/types";

/**
 * 通用 JSON Schema：每个 master agent 的结构化输出（MasterSignal）。
 * 与 ai-hedge-fund 中的 pydantic 模型对应。
 */
export const signalSchema = {
  type: "object",
  additionalProperties: false,
  required: ["signal", "confidence", "reasoning"],
  properties: {
    signal: { type: "string", enum: ["bullish", "bearish", "neutral"] },
    confidence: { type: "number", minimum: 0, maximum: 100 },
    reasoning: { type: "string", maxLength: 500 },
    keyMetrics: {
      type: "object",
      additionalProperties: { type: ["number", "string"] },
    },
  },
} as const;

export type RawSignalOutput = {
  signal: "bullish" | "bearish" | "neutral";
  confidence: number;
  reasoning: string;
  keyMetrics?: Record<string, number | string>;
};

/** 容错：把任意 AI 返回值规整成 MasterSignal。 */
export function normalizeSignal(raw: unknown, fallback: MasterSignal): MasterSignal {
  if (!raw || typeof raw !== "object") return fallback;
  const r = raw as Record<string, unknown>;
  const sig = r.signal;
  const conf = Number(r.confidence);
  const reason = typeof r.reasoning === "string" ? r.reasoning : "";
  const km =
    r.keyMetrics && typeof r.keyMetrics === "object"
      ? (r.keyMetrics as Record<string, number | string>)
      : undefined;

  const signal: MasterSignal["signal"] =
    sig === "bullish" || sig === "bearish" || sig === "neutral" ? sig : fallback.signal;

  const confidence = Number.isFinite(conf)
    ? Math.max(0, Math.min(100, conf))
    : fallback.confidence;
  const reasoning = reason.length > 0 ? reason.slice(0, 500) : fallback.reasoning;

  return { signal, confidence, reasoning, keyMetrics: km ?? fallback.keyMetrics };
}

/**
 * 把 master 内部的 MasterSignal（0-100，signal/reasoning/keyMetrics）
 * 适配成法庭编排器使用的 AnalystSignal（0-1，direction/thesis/keyPoints）。
 * 这是 master 模块的 default 导出返回值。
 */
export function toAnalystSignal(
  masterName: string,
  ms: MasterSignal,
  mode: "live" | "fallback" | "disabled",
  fallbackReason?: string,
): AnalystSignal {
  const points: string[] = [];
  if (ms.keyMetrics) {
    for (const [k, v] of Object.entries(ms.keyMetrics)) {
      points.push(`${k}: ${v}`);
    }
  }
  const prefix = mode === "live" ? "" : mode === "fallback" ? "[启发式回退] " : "[AI未启用] ";
  const suffix = fallbackReason ? `（回退原因：${fallbackReason}）` : "";
  return {
    direction: ms.signal,
    confidence: Math.max(0, Math.min(1, ms.confidence / 100)),
    thesis: `${prefix}${masterName}：${ms.reasoning}${suffix}`,
    keyPoints: points.length > 0 ? points.slice(0, 6) : [ms.signal, `信心度 ${ms.confidence}%`],
    timeHorizon: "中短期",
  };
}

export function fmt(n: number | undefined, digits = 2, suffix = ""): string {
  if (n === undefined || !Number.isFinite(n)) return "N/A";
  return `${n.toFixed(digits)}${suffix}`;
}
