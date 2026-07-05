export type XApiRouteMode = "live" | "fallback" | "unconfigured";

export type XApiTraceStatus = "success" | "failed" | "fallback";

export interface XApiRuntimeTrace {
  id: string;
  taskId?: string;
  action: string;
  capability: string;
  status: XApiTraceStatus;
  input: Record<string, unknown>;
  inputHash: string;
  outputHash?: string;
  latencyMs: number;
  timestamp: string;
  error?: string;
}

export interface XApiRouteError {
  code: string;
  message: string;
  recoverable: boolean;
}

export type XApiRouteResponse<T> = {
  ok: boolean;
  mode: XApiRouteMode;
  data?: T;
  trace?: XApiRuntimeTrace;
  error?: XApiRouteError;
};

export interface XApiActionSearchResult {
  action: string;
  capability: string;
  description?: string;
}

export interface XApiActionSchema {
  action: string;
  capability?: string;
  schemaVersion?: string;
  input: Record<string, unknown>;
  raw?: unknown;
}

export interface XApiCallResult {
  action: string;
  capability: string;
  output: Record<string, unknown>;
  outputPreview: string;
  raw?: unknown;
}

export interface XApiHealthStatus {
  configured: boolean;
  host: string;
  upstreamAvailable: boolean;
  cli: "skipped" | "available" | "unavailable";
  message: string;
}

export type XApiServiceResult<T> = Pick<XApiRouteResponse<T>, "ok" | "mode" | "data"> & {
  trace: XApiRuntimeTrace;
  error?: XApiRouteError;
};
