import { NextResponse } from "next/server";
import { loadPortfolio, primeStore } from "@/lib/server/case-store";
import { getPortfolioSummary } from "@/lib/server/portfolio-manager";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  await primeStore().catch(() => undefined);
  const portfolio = loadPortfolio();
  const summary = getPortfolioSummary(portfolio);
  return NextResponse.json({
    ok: true,
    data: {
      summary,
      cash: portfolio.cash,
      positions: portfolio.positions,
      tradeLog: portfolio.tradeLog.slice(-50),
      initialBalance: portfolio.initialBalance,
      updatedAt: portfolio.updatedAt,
    },
  });
}
