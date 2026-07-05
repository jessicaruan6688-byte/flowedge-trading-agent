import type { LucideIcon } from "lucide-react";
import { InboxIcon } from "lucide-react";

export function EmptyState({
  title,
  detail,
  icon: Icon = InboxIcon,
  action
}: {
  title: string;
  detail?: string;
  icon?: LucideIcon;
  action?: React.ReactNode;
}) {
  return (
    <div className="rounded-lg border border-dashed border-[#E0E0E0] bg-white p-10 text-center">
      <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-[#F5F5F5] text-[#A3A3A3]">
        <Icon aria-hidden className="h-6 w-6" />
      </span>
      <p className="mt-3 text-sm font-semibold text-[#0A0A0A]">{title}</p>
      {detail ? <p className="mt-1 text-sm text-[#737373]">{detail}</p> : null}
      {action ? <div className="mt-4 flex justify-center">{action}</div> : null}
    </div>
  );
}
