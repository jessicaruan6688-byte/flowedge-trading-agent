import { NextResponse } from "next/server";
import type { XApiRouteMode, XApiRouteResponse } from "@/lib/xapi-types";

export function xapiJson<T>(body: XApiRouteResponse<T>, init?: ResponseInit) {
  return NextResponse.json(body, init);
}

export function xapiBadRequest(message: string) {
  return xapiJson(
    {
      ok: false,
      mode: currentMode(),
      error: {
        code: "BAD_REQUEST",
        message,
        recoverable: true
      }
    },
    { status: 400 }
  );
}

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function currentMode(): XApiRouteMode {
  return process.env.XAPI_KEY ? "fallback" : "unconfigured";
}
