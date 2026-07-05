import { NextResponse } from "next/server";
import { getCase, getTraces, primeStore } from "@/lib/server/case-store";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> | { id: string } },
) {
  await primeStore().catch(() => undefined);
  const resolved = await params;
  const id = resolved.id;
  const tradeCase = getCase(id);
  if (!tradeCase) {
    return NextResponse.json({ ok: false, error: "案件未找到" }, { status: 404 });
  }
  const traces = getTraces(id);
  return NextResponse.json({ ok: true, data: { tradeCase, traces } });
}
