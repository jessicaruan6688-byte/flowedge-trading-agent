import type { Report, ReportFilters, WatchlistFilters, WatchlistTarget } from "./types";

const includesText = (source: string, query: string) =>
  source.toLowerCase().includes(query.trim().toLowerCase());

export function filterReports(items: Report[], filters: ReportFilters): Report[] {
  return items.filter((report) => {
    const query = filters.query ?? "";
    const queryMatch =
      query.trim().length === 0 ||
      includesText(`${report.title ?? ""} ${report.topic ?? ""} ${report.summary ?? ""}`, query);
    const modeMatch = filters.mode === "All" || report.mode === filters.mode;
    const verdictMatch = filters.verdict === "All" || report.verdict === filters.verdict;
    const statusMatch = filters.status === "All" || report.status === filters.status;
    const minRisk = clampRisk(filters.minRisk);
    const maxRisk = clampRisk(filters.maxRisk);
    const riskScore = report.riskScore ?? 0;
    const riskMatch = riskScore >= Math.min(minRisk, maxRisk) && riskScore <= Math.max(minRisk, maxRisk);
    const reportDate = (report.createdAt ?? "").slice(0, 10);
    const startMatch = (filters.startDate ?? "").length === 0 || reportDate >= (filters.startDate ?? "");
    const endMatch = (filters.endDate ?? "").length === 0 || reportDate <= (filters.endDate ?? "");

    return queryMatch && modeMatch && verdictMatch && statusMatch && riskMatch && startMatch && endMatch;
  });
}

export function filterWatchlist(items: WatchlistTarget[], filters: WatchlistFilters): WatchlistTarget[] {
  const filtered = items.filter((target) => {
    const query = filters.query ?? "";
    const queryMatch =
      query.trim().length === 0 ||
      includesText(`${target.name ?? ""} ${target.symbol} ${target.category ?? ""}`, query);
    const categoryMatch = filters.category === "All" || target.category === filters.category;
    const alertMatch = filters.alertState === "All" || target.alertState === filters.alertState;

    return queryMatch && categoryMatch && alertMatch;
  });

  return [...filtered].sort((a, b) => {
    if (filters.sortBy === "alpha-desc") return (b.alphaScore ?? 0) - (a.alphaScore ?? 0);
    if (filters.sortBy === "recent")
      return (a.lastScan ?? "").localeCompare(b.lastScan ?? "");
    return (b.riskScore ?? 0) - (a.riskScore ?? 0);
  });
}

export function clampRisk(value: number): number {
  if (Number.isNaN(value)) return 0;
  return Math.min(100, Math.max(0, value));
}
