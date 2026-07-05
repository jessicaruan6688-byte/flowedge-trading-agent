import { createRuntimeTrace, redactSensitive } from "@/lib/server/xapi-trace";
import { normalizeCallOutput, normalizeSchemaOutput, normalizeSearchOutput } from "@/lib/server/xapi-normalize";
import type { XApiActionSchema, XApiActionSearchResult, XApiCallResult, XApiHealthStatus, XApiRouteError, XApiServiceResult } from "@/lib/xapi-types";

const defaultMcpHost = "mcp.xapi.to";
const defaultActionHost = "action.xapi.to";
const defaultTimeoutMs = 12_000;
let mcpRequestId = 1;

export interface XApiHttpOptions {
  method?: "GET" | "POST";
  body?: unknown;
  apiKey: string;
  host: string;
  timeoutMs: number;
}

export interface XApiServiceOptions {
  env?: Partial<NodeJS.ProcessEnv>;
  runner?: (path: string, options: XApiHttpOptions) => Promise<unknown>;
}

export interface XApiService {
  searchActions(query: string): Promise<XApiServiceResult<XApiActionSearchResult[]>>;
  getActionSchema(actionId: string): Promise<XApiServiceResult<XApiActionSchema>>;
  callAction(actionId: string, input: Record<string, unknown>, taskId?: string, options?: { schemaFetched?: boolean }): Promise<XApiServiceResult<XApiCallResult>>;
  healthCheck(): Promise<XApiServiceResult<XApiHealthStatus>>;
}

export function createXApiService(options: XApiServiceOptions = {}): XApiService {
  const env = { ...process.env, ...options.env };
  const customRunner = options.runner;
  const apiKey = env.XAPI_KEY;
  const actionHost = env.XAPI_ACTION_HOST || defaultActionHost;
  const mcpHost = env.XAPI_MCP_HOST || defaultMcpHost;
  const timeoutMs = readTimeout(env.XAPI_TIMEOUT_MS);

  async function mcpCall(toolName: string, args: Record<string, unknown>): Promise<string> {
    const id = mcpRequestId++;
    const path = `/mcp?apikey=${encodeURIComponent(apiKey!)}`;
    const body = {
      jsonrpc: "2.0",
      method: "tools/call",
      params: { name: toolName, arguments: args },
      id
    };
    const httpOpts: XApiHttpOptions = { method: "POST", body, apiKey: apiKey!, host: mcpHost, timeoutMs };
    const raw = customRunner
      ? await customRunner(path, httpOpts)
      : await callMcpHttp(mcpHost, apiKey!, timeoutMs, body);
    return extractMcpText(raw);
  }

  async function healthHttp(): Promise<{ status?: string; service?: string }> {
    const httpOpts: XApiHttpOptions = { method: "GET", apiKey: apiKey!, host: actionHost, timeoutMs };
    if (customRunner) {
      return (await customRunner("/health", httpOpts)) as { status?: string; service?: string };
    }
    return fetchActionApi<{ status?: string; service?: string }>("/health", apiKey!, actionHost, timeoutMs);
  }

  function noKeyResult<T>(taskId: string | undefined, action: string, capability: string, input: Record<string, unknown>, startedAt: number): XApiServiceResult<T> {
    return {
      ok: false,
      mode: "unconfigured",
      trace: createRuntimeTrace({ taskId, action, capability, status: "fallback", input, startedAt, error: "no XAPI_KEY configured" }),
      error: { code: "XAPI_KEY_MISSING", message: "no XAPI_KEY configured", recoverable: true }
    };
  }

  return {
    async healthCheck() {
      const startedAt = Date.now();
      const action = "xapi.health";
      const capability = "xAPI";
      const input = { host: actionHost };

      if (!apiKey) return noKeyResult(undefined, action, capability, input, startedAt);

      try {
        const raw = await healthHttp();
        const data: XApiHealthStatus = {
          configured: true,
          host: actionHost,
          upstreamAvailable: true,
          cli: "skipped",
          message: `xAPI MCP connected — ${raw.service ?? "action"} ${raw.status ?? "ok"}`
        };
        return {
          ok: true,
          mode: "live",
          data,
          trace: createRuntimeTrace({ action, capability, status: "success", input, output: data, startedAt })
        };
      } catch (error) {
        const safeMessage = redactSensitive(error, [apiKey]);
        return {
          ok: false,
          mode: "fallback",
          trace: createRuntimeTrace({ action, capability, status: "fallback", input, startedAt, error: safeMessage }),
          error: upstreamError(safeMessage)
        };
      }
    },

    async searchActions(query) {
      const startedAt = Date.now();
      const action = "xapi.search";
      const capability = "xAPI";
      const input = { query };

      if (!apiKey) return noKeyResult(undefined, action, capability, input, startedAt);

      try {
        const text = await mcpCall("SEARCH", { query, page_size: 10 });
        const parsed = parseMcpText(text);
        const data = normalizeSearchOutput(parsed, query);
        return {
          ok: true,
          mode: "live",
          data,
          trace: createRuntimeTrace({ action, capability, status: "success", input, output: data, startedAt })
        };
      } catch (error) {
        const safeMessage = redactSensitive(error, [apiKey]);
        return {
          ok: false,
          mode: "fallback",
          trace: createRuntimeTrace({ action, capability, status: "fallback", input, startedAt, error: safeMessage }),
          error: upstreamError(safeMessage)
        };
      }
    },

    async getActionSchema(actionId) {
      const startedAt = Date.now();
      const action = actionId;
      const capability = "Schema Discovery";
      const input = { action: actionId };

      if (!apiKey) return noKeyResult(undefined, action, capability, input, startedAt);

      try {
        const text = await mcpCall("GET", { action_id: actionId });
        const parsed = parseMcpText(text);
        const data = normalizeSchemaOutput(actionId, parsed);
        return {
          ok: true,
          mode: "live",
          data,
          trace: createRuntimeTrace({ action, capability, status: "success", input, output: data, startedAt })
        };
      } catch (error) {
        const safeMessage = redactSensitive(error, [apiKey]);
        return {
          ok: false,
          mode: "fallback",
          trace: createRuntimeTrace({ action, capability, status: "fallback", input, startedAt, error: safeMessage }),
          error: upstreamError(safeMessage)
        };
      }
    },

    async callAction(actionId, input, taskId, callOptions = {}) {
      const startedAt = Date.now();
      const capability = inferCapability(actionId);

      if (!apiKey) return noKeyResult(taskId, actionId, capability, input, startedAt);

      try {
        if (!callOptions.schemaFetched) {
          await mcpCall("GET", { action_id: actionId });
        }
        const text = await mcpCall("CALL", { action_id: actionId, arguments: input });
        const parsed = parseMcpText(text);
        const data = normalizeCallOutput(actionId, input, parsed);
        return {
          ok: true,
          mode: "live",
          data,
          trace: createRuntimeTrace({ taskId, action: actionId, capability: data.capability, status: "success", input, output: data, startedAt })
        };
      } catch (error) {
        const safeMessage = redactSensitive(error, [apiKey]);
        return {
          ok: false,
          mode: "fallback",
          trace: createRuntimeTrace({ taskId, action: actionId, capability, status: "fallback", input, startedAt, error: safeMessage }),
          error: upstreamError(safeMessage)
        };
      }
    }
  };
}

async function callMcpHttp(host: string, apiKey: string, timeoutMs: number, body: unknown): Promise<unknown> {
  const url = `https://${host}/mcp?apikey=${encodeURIComponent(apiKey)}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Accept": "application/json, text/event-stream"
      },
      body: JSON.stringify(body),
      signal: controller.signal
    });

    return await response.json();
  } finally {
    clearTimeout(timeout);
  }
}

async function fetchActionApi<T>(path: string, apiKey: string, host: string, timeoutMs: number): Promise<T> {
  const url = `https://${host}${path}`;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "XAPI-Key": apiKey,
        "Accept": "application/json"
      },
      signal: controller.signal
    });

    if (!response.ok) {
      const text = await response.text().catch(() => "");
      throw new Error(`xAPI HTTP ${response.status}: ${text.slice(0, 200)}`);
    }

    return response.json() as Promise<T>;
  } finally {
    clearTimeout(timeout);
  }
}

function extractMcpText(raw: unknown): string {
  if (!isRecord(raw)) throw new Error("MCP response is not a JSON object");

  if (isRecord(raw.error)) {
    throw new Error(`MCP RPC error ${raw.error.code ?? "?"}: ${raw.error.message ?? "unknown"}`);
  }

  const result = raw.result;
  if (!isRecord(result)) throw new Error("MCP response has no result");

  const content = result.content;
  if (!Array.isArray(content) || content.length === 0) throw new Error("MCP response has no content");

  const text = (content as Array<{ type?: string; text?: string }>).find((c) => c.type === "text")?.text ?? "";

  if (result.isError) throw new Error(`xAPI tool error: ${text.slice(0, 200)}`);

  return text;
}

function parseMcpText(text: string): unknown {
  if (!text.trim()) return {};
  try {
    return JSON.parse(text);
  } catch {
    return { raw: text };
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readTimeout(value: string | undefined) {
  const parsed = Number(value);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : defaultTimeoutMs;
}

function upstreamError(message: string): XApiRouteError {
  return { code: "UPSTREAM_FAILED", message, recoverable: true };
}

function inferCapability(action: string) {
  const prefix = action.split(".")[0];
  const map: Record<string, string> = {
    ai: "AI",
    crypto: "Crypto",
    news: "News",
    twitter: "Twitter / X",
    web: "Web"
  };
  return map[prefix] ?? "xAPI";
}
