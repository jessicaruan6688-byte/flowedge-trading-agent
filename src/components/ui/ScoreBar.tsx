import clsx from "clsx";

export function ScoreBar({
  value,
  label,
  reverse = false
}: {
  value: number;
  label?: string;
  reverse?: boolean;
}) {
  // When reverse: high score = bullish/green (e.g. confidence)
  // Otherwise: high score = bearish/red (e.g. risk)
  const clamped = Math.max(0, Math.min(100, value));
  const color = reverse
    ? clamped >= 70
      ? "bg-[#22C55E]"
      : clamped >= 50
        ? "bg-[#007acc]"
        : "bg-[#EF4444]"
    : clamped >= 70
      ? "bg-[#EF4444]"
      : clamped >= 50
        ? "bg-[#EAB308]"
        : "bg-[#22C55E]";
  const textColor = reverse
    ? clamped >= 70
      ? "text-green-600 font-semibold"
      : clamped >= 50
        ? "text-[#007acc] font-semibold"
        : "text-red-500 font-semibold"
    : clamped >= 70
      ? "text-red-500 font-semibold"
      : clamped >= 50
        ? "text-amber-600 font-semibold"
        : "text-green-600 font-semibold";

  return (
    <div className="min-w-[120px]">
      <div className="mb-1 flex items-baseline justify-between text-xs">
        {label ? <span className="text-[#737373]">{label}</span> : null}
        <span className="ml-auto flex items-baseline gap-0.5 tabular-nums">
          <span className={clsx(textColor)}>{Math.round(clamped)}</span>
          <span className="text-[#B3B3B3]">/100</span>
        </span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-[#F5F5F5]">
        <div className={clsx("h-full rounded-full transition-all", color)} style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}
