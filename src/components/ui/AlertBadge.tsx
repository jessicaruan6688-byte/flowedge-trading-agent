import clsx from "clsx";
import type { WatchlistTarget } from "@/lib/types";

export function AlertBadge({ state }: { state: WatchlistTarget["alertState"] }) {
  const cls =
    state === "Normal"
      ? "bg-green-50 text-green-700 border border-green-200"
      : state === "Warning"
        ? "bg-amber-50 text-amber-700 border border-amber-200"
        : "bg-red-50 text-red-700 border border-red-200";

  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold", cls)}>{state}</span>;
}
