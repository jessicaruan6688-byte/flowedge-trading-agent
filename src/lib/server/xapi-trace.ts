import { createHash, randomBytes } from "node:crypto";
import type { XApiRuntimeTrace, XApiTraceStatus } from "@/lib/xapi-types";

export function createTraceId() {
  return `cp-xapi-${Date.now().toString(36)}-${randomBytes(4).toString("hex")}`;
}

export function hashJson(value: unknown) {
  return `0x${createHash("sha256").update(stableStringify(value)).digest("hex")}`;
}

export function createRuntimeTrace({
  taskId,
  action,
  capability,
  status,
  input,
  output,
  startedAt,
  error
}: {
  taskId?: string;
  action: string;
  capability: string;
  status: XApiTraceStatus;
  input: Record<string, unknown>;
  output?: unknown;
  startedAt: number;
  error?: string;
}): XApiRuntimeTrace {
  return {
    id: createTraceId(),
    taskId,
    action,
    capability,
    status,
    input,
    inputHash: hashJson(input),
    outputHash: output === undefined ? undefined : hashJson(output),
    latencyMs: Math.max(0, Date.now() - startedAt),
    timestamp: new Date().toISOString(),
    error
  };
}

export function redactSensitive(value: unknown, secrets: Array<string | undefined>) {
  const secretValues = secrets.filter((secret): secret is string => Boolean(secret));
  let text = value instanceof Error ? value.message : String(value);

  for (const secret of secretValues) {
    text = text.split(secret).join("[redacted]");
  }

  return text
    .replace(/Bearer\s+sk-[A-Za-z0-9_-]+/g, "Bearer [redacted]")
    .replace(/sk-[A-Za-z0-9_-]+/g, "[redacted]")
    .slice(0, 300);
}

function stableStringify(value: unknown): string {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map((item) => stableStringify(item)).join(",")}]`;

  const record = value as Record<string, unknown>;
  return `{${Object.keys(record)
    .sort()
    .map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
    .join(",")}}`;
}
