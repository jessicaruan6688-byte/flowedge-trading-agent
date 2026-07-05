import { NextResponse } from "next/server";

type GuardFailure = {
  status: number;
  code: string;
  message: string;
};

type RateBucket = {
  windowStart: number;
  count: number;
};

type GuardScope = "agent-run" | "xapi" | "ai" | "read";

const rateBuckets = new Map<string, RateBucket>();
const defaultWindowMs = 60_000;
const defaultAgentLimit = 12;
const defaultXApiLimit = 60;
const defaultAiLimit = 30;
const defaultReadLimit = 120;
export const operatorCookieName = "chainpulse_operator_token";
const defaultAllowedActions = [
  "ai.text.summarize",
  "ai.text.chat.fast",
  "crypto.token.price",
  "crypto.token.metadata",
  "twitter.search",
  "web.search.news",
  "web.search.realtime"
];

export function rejectJson(failure: GuardFailure) {
  return NextResponse.json(
    {
      ok: false,
      error: {
        code: failure.code,
        message: failure.message,
        recoverable: true
      }
    },
    { status: failure.status }
  );
}

export function authorizeOperator(request: Request): GuardFailure | null {
  const expectedToken = process.env.AGENT_OPERATOR_TOKEN?.trim();
  if (!expectedToken) return null;

  const headerToken = request.headers.get("x-chainpulse-operator-token")?.trim();
  const bearerToken = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "").trim();
  const cookieToken = readCookie(request, operatorCookieName)?.trim();

  if (headerToken === expectedToken || bearerToken === expectedToken || cookieToken === expectedToken) return null;

  return {
    status: 401,
    code: "UNAUTHORIZED",
    message: "operator token is required"
  };
}

export function readOperatorSession(request: Request) {
  const expectedToken = process.env.AGENT_OPERATOR_TOKEN?.trim();
  if (!expectedToken) {
    return {
      configured: false,
      authenticated: true,
      mode: "unconfigured" as const
    };
  }

  const cookieToken = readCookie(request, operatorCookieName)?.trim();
  const authenticated = cookieToken === expectedToken;
  return {
    configured: true,
    authenticated,
    mode: authenticated ? ("authenticated" as const) : ("locked" as const)
  };
}

export function enforceRateLimit(request: Request, scope: GuardScope, limit = defaultLimitForScope(scope)): GuardFailure | null {
  const configuredLimit = readLimit(scope, limit);
  if (configuredLimit <= 0) return null;

  const now = Date.now();
  const key = `${scope}:${readClientId(request)}`;
  const bucket = rateBuckets.get(key);

  if (!bucket || now - bucket.windowStart >= defaultWindowMs) {
    rateBuckets.set(key, {
      windowStart: now,
      count: 1
    });
    return null;
  }

  bucket.count += 1;
  if (bucket.count <= configuredLimit) return null;

  return {
    status: 429,
    code: "RATE_LIMITED",
    message: `rate limit exceeded for ${scope}`
  };
}

export function enforceJsonBodySize(body: unknown, maxBytes = 8192): GuardFailure | null {
  const size = new TextEncoder().encode(JSON.stringify(body ?? null)).byteLength;
  if (size <= maxBytes) return null;

  return {
    status: 413,
    code: "PAYLOAD_TOO_LARGE",
    message: `request body exceeds ${maxBytes} bytes`
  };
}

export function isAllowedXApiAction(action: string) {
  const allowed = readAllowedActions();
  return allowed.includes(action);
}

export function assertAllowedXApiAction(action: string): GuardFailure | null {
  if (isAllowedXApiAction(action)) return null;

  return {
    status: 400,
    code: "ACTION_NOT_ALLOWED",
    message: `xAPI action is not allowed: ${action}`
  };
}

export function filterAllowedXApiActions(actions: string[]) {
  return actions.filter(isAllowedXApiAction);
}

function readAllowedActions() {
  const configured = process.env.XAPI_ALLOWED_ACTIONS?.split(",").map((action) => action.trim()).filter(Boolean);
  return configured?.length ? configured : defaultAllowedActions;
}

function readLimit(scope: GuardScope, fallback: number) {
  const key = scope === "agent-run" ? "AGENT_RUN_RATE_LIMIT_PER_MIN" : scope === "xapi" ? "XAPI_ROUTE_RATE_LIMIT_PER_MIN" : scope === "ai" ? "AI_ROUTE_RATE_LIMIT_PER_MIN" : "READ_ROUTE_RATE_LIMIT_PER_MIN";
  const parsed = Number(process.env[key]);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function defaultLimitForScope(scope: GuardScope) {
  if (scope === "agent-run") return defaultAgentLimit;
  if (scope === "xapi") return defaultXApiLimit;
  if (scope === "ai") return defaultAiLimit;
  return defaultReadLimit;
}

function readClientId(request: Request) {
  return request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || request.headers.get("x-real-ip")?.trim() || "local";
}

function readCookie(request: Request, name: string) {
  const cookieHeader = request.headers.get("cookie");
  if (!cookieHeader) return undefined;

  for (const segment of cookieHeader.split(";")) {
    const [rawKey, ...rawValue] = segment.trim().split("=");
    if (rawKey === name) return decodeURIComponent(rawValue.join("="));
  }
  return undefined;
}
