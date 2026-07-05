import { NextResponse } from "next/server";
import { listCases, primeStore } from "@/lib/server/case-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  await primeStore().catch(() => undefined);
  const url = new URL(request.url);
  const symbol = url.searchParams.get("symbol") ?? undefined;
  const status = url.searchParams.get("status") ?? undefined;
  const limitRaw = url.searchParams.get("limit");
  const limit = limitRaw ? Math.max(1, parseInt(limitRaw, 10) || 20) : 50;
  const cases = listCases({ symbol, status, limit });
  return NextResponse.json({ ok: true, data: cases, count: cases.length });
}
