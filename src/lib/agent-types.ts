import type { AgentAiAudit } from "@/lib/ai-types";
import type {
  RunningTask,
  SourceMode,
  TradeDebate,
  WorkspaceRunContext,
  XApiTrace,
} from "@/lib/types";

/**
 * A persisted debate run: the aggregate the backend stores per agent
 * invocation. Replaces the old StoredAgentRun (which carried Report + task).
 */
export interface StoredDebateRun {
  debate: TradeDebate;
  task: RunningTask;
  traces: XApiTrace[];
  context: WorkspaceRunContext;
  sourceMode: SourceMode;
  ai?: AgentAiAudit;
  createdAt: string;
  updatedAt: string;
}

/**
 * Backwards-compatible alias: old code accesses `.report` — we expose both
 * `.report` (legacy) and `.debate` (new) via a single shape so existing
 * adapters/tests keep compiling while the refactor proceeds.
 */
export interface StoredAgentRun extends StoredDebateRun {
  report: TradeDebate;
}

// -----------------------------------------------------------------------------
// API response envelopes (all follow { ok, data, error })
// -----------------------------------------------------------------------------

export interface AgentRunApiResponse {
  ok: boolean;
  data?: StoredDebateRun;
  error?: {
    code: string;
    message: string;
    recoverable?: boolean;
  };
}

export interface AgentCollectionResponse<T> {
  ok: boolean;
  data: T[];
  error?: {
    code: string;
    message: string;
    recoverable?: boolean;
  };
}

export interface AgentEntityResponse<T> {
  ok: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    recoverable?: boolean;
  };
}
