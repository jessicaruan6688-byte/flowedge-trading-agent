import { NextResponse } from "next/server";
import { getTraces, primeStore } from "@/lib/server/case-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await primeStore().catch(() => undefined);
  const url = new URL(request.url);
  const caseId = url.searchParams.get("caseId") ?? url.searchParams.get("case") ?? undefined;
  const traces = getTraces(caseId);
  return NextResponse.json({ ok: true, data: traces, count: traces.length });
}
