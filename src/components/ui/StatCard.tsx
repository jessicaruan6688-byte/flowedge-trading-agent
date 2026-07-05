import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { cardClass } from "./styles";

export function StatCard({
  icon: Icon,
  label,
  value,
  detail,
  tone = "default",
  accent = false,
}: {
  icon?: LucideIcon;
  label: string;
  value: string;
  detail?: string;
  tone?: "default" | "blue" | "green" | "orange" | "black" | "amber" | "neutral";
  accent?: boolean;
}) {
  const toneValue = {
    default: "text-[#0A0A0A]",
    blue: "text-[#007acc]",
    amber: "text-[#B45309]",
    green: "text-[#15803D]",
    orange: "text-[#C2410C]",
    black: "text-[#0A0A0A]",
    neutral: "text-[#0A0A0A]",
  }[tone];

  const iconClasses = {
    default: "bg-[#F5F5F5] text-[#444] ring-[#E0E0E0]",
    blue: "bg-[#E6F2FA] text-[#007acc] ring-[#B3D9EF]",
    amber: "bg-amber-50 text-amber-600 ring-amber-200",
    green: "bg-green-50 text-green-600 ring-green-200",
    orange: "bg-orange-50 text-orange-600 ring-orange-200",
    black: "bg-[#0A0A0A] text-white ring-[#0A0A0A]/20",
    neutral: "bg-[#F5F5F5] text-[#444] ring-[#E0E0E0]",
  }[tone];

  return (
    <div className={clsx(cardClass, "p-4")}>
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-[#737373]">
            {label}
          </p>
          <p
            className={clsx(
              "mt-1.5 text-xl font-semibold tracking-tight tabular-nums",
              accent ? "font-mono" : "",
              toneValue,
            )}
          >
            {value}
          </p>
          {detail ? <p className="mt-1 text-[11px] text-[#A3A3A3]">{detail}</p> : null}
        </div>
        {Icon ? (
          <span className={clsx("grid h-9 w-9 shrink-0 place-items-center rounded-md ring-1", iconClasses)}>
            <Icon aria-hidden className="h-4 w-4" />
          </span>
        ) : null}
      </div>
    </div>
  );
}
