import { NextRequest } from "next/server";
import { runCourtSession } from "@/lib/server/court-runner";
import { primeStore } from "@/lib/server/case-store";
import type { CourtContext, AnalysisMode } from "@/lib/types";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    symbol?: string;
    userIdea?: string;
    mode?: string;
  };

  const rawSymbol = (body.symbol ?? "").trim();
  if (!rawSymbol) {
    return new Response(JSON.stringify({ ok: false, error: "symbol 必填" }), {
      status: 400,
      headers: { "content-type": "application/json" },
    });
  }

  // 规范化港股代码
  const normalized = rawSymbol.toUpperCase().replace(".HK", "").replace(/^0+/, "").padStart(4, "0") + ".HK";
  const mode: AnalysisMode =
    body.mode === "Swing" || body.mode === "Event" || body.mode === "Sentiment" ? body.mode : "Spot";

  const context: CourtContext = {
    taskId: `task-${Date.now().toString(36)}`,
    symbol: normalized,
    userIdea: body.userIdea ?? "",
    mode,
    advancedFilters: {},
    language: "zh",
    createdAt: new Date().toISOString(),
    replaySpeed: 60,
  };

  // prime store before streaming
  await primeStore().catch(() => undefined);

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (data: unknown) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(data)}\n\n`));
      };

      try {
        const result = await runCourtSession({
          context,
          onEvent: (event) => send(event),
        });
        send({ type: "done", caseId: result.caseId, verdict: result.direction });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);
        send({ type: "error", message, recoverable: false });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
