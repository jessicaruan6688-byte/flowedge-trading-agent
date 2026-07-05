export function ProgressBar({ value, label }: { value: number; label?: string }) {
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs text-[#737373]">
        <span className="text-[10px] font-semibold uppercase tracking-wider">Progress</span>
        {label ? <span className="font-mono text-[11px] text-[#444]">{label}</span> : null}
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[#F5F5F5]">
        <div
          className="h-full rounded-full bg-gradient-to-r from-[#007acc] via-[#6366F1] to-[#A855F7] bg-[length:200%_100%] animate-progress-shimmer"
          style={{ width: `${Math.max(0, Math.min(100, value))}%` }}
        />
      </div>
    </div>
  );
}
