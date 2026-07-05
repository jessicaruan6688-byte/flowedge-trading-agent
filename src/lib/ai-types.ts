import type { OrderSide, RiskCheckResult, SourceMode, TraceSource, Verdict } from "@/lib/types";

// -----------------------------------------------------------------------------
// Provider / runtime
// -----------------------------------------------------------------------------

export type AiProviderMode = "live" | "fallback" | "disabled";

export interface AiGenerateOptions {
  system: string;
  user: string;
  schema?: unknown;
  temperature?: number;
  model?: string;
}

export interface AiGenerateResult<T = unknown> {
  ok: boolean;
  mode: AiProviderMode;
  provider: string;
  model: string;
  baseUrl: string;
  data?: T;
  raw?: unknown;
  error?: {
    code: string;
    message: string;
    recoverable: boolean;
  };
  trace: {
    promptHash: string;
    outputHash: string;
    latencyMs: number;
  };
}

export interface AiHealthStatus {
  provider: string;
  model: string;
  baseUrl: string;
  enabled: boolean;
  configured: boolean;
  mode: AiProviderMode;
}

// -----------------------------------------------------------------------------
// Legacy plan/report shapes (kept so old server code compiles)
// -----------------------------------------------------------------------------

export interface AgentPlan {
  objective: string;
  selectedTools: string[];
  reason: string;
  evidenceStrategy: string;
  riskQuestions: string[];
}

export interface AiReportDraft {
  title: string;
  summary: string;
  verdict: Verdict | "POSITIVE" | "OBSERVE" | "CAUTION" | "NEGATIVE";
  riskScore: number;
  alphaScore: number;
  confidence: number;
  rationale: string[];
  actions: string[];
}

// -----------------------------------------------------------------------------
// Trading-agent outputs (per pipeline stage)
// -----------------------------------------------------------------------------

/** Bull analyst — argues for a long / positive case. */
export interface BullAnalystOutput {
  thesis: string;
  arguments: string[]; // 3-5
  targetPrice: number;
  timeHorizon: string;
  confidence: number; // 0..1
  supportingEvidenceIds: string[];
  risksAcknowledged: string[]; // 2+
}

/** Bear analyst — argues for a short / negative case, attacks the bull thesis. */
export interface BearAnalystOutput {
  counterThesis: string;
  arguments: string[]; // 3-5
  targetPrice: number;
  timeHorizon: string;
  confidence: number; // 0..1
  bullFlaws: string[]; // 2-4
  supportingEvidenceIds: string[];
}

/** Strategist — turns the debate into a concrete trade plan. */
export interface StrategistOutput {
  direction: OrderSide;
  entryPrice?: number;
  positionSizePct: number;
  takeProfitPrice?: number;
  stopLossPrice?: number;
  holdingPeriod: string;
  reasoning: string[]; // 3-5
  leverage?: number;
}

/** Risk manager — approves / rejects / resizes the plan. */
export interface RiskManagerOutput {
  result: RiskCheckResult;
  adjustedSizePct?: number;
  reason: string[]; // 2-5
  maxDrawdownAllowed: number;
  riskRewardRatio?: number;
  vetoReason?: string;
}

/** Reviewer — post-trade lessons that feed the memory bank. */
export interface ReviewerOutput {
  summary: string;
  whatWentRight: string[]; // 2-4
  whatWentWrong: string[]; // 2-4
  lessonsLearned: string[]; // 2-5
  adjustmentsForNext: string[]; // 2-4
  confidenceDelta: number; // signed, -1..1
}

// -----------------------------------------------------------------------------
// Audit trail
// -----------------------------------------------------------------------------

export interface AgentToolCallAudit {
  source: TraceSource;
  action: string;
  mode: SourceMode;
  status: string;
  inputHash: string;
  outputHash: string;
  latencyMs: number;
}

/** One of the five agent calls in the pipeline. */
export interface AgentCallAudit {
  /** Pipeline stage key, e.g. "analyst_bull" | "strategist" | "risk_manager" | ... */
  agent: TraceSource;
  provider: string;
  model: string;
  baseUrl: string;
  promptHash: string;
  outputHash: string;
  mode: AiProviderMode;
  latencyMs: number;
  status: "success" | "failed" | "fallback";
  reasoningSummary?: string;
  fallbackReason?: string;
  /** Raw structured output from the model (bull/bear/strategist/risk/reviewer). */
  output?: unknown;
  error?: string;
}

export interface AgentAiAudit {
  provider: string;
  model: string;
  baseUrl: string;
  promptHash: string;
  outputHash: string;
  mode: AiProviderMode;
  plan?: AgentPlan;
  toolPlan?: string[];
  toolCalls?: AgentToolCallAudit[];
  reasoningSummary?: string;
  fallbackReason?: string;
  /** All five agent calls that ran during this debate, in order. */
  agents?: AgentCallAudit[];
}
