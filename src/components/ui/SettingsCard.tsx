import clsx from "clsx";
import type { LucideIcon } from "lucide-react";
import { cardClass } from "./styles";

export function SettingsCard({ title, icon: Icon, children, action }: { title: string; icon?: LucideIcon; children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className={clsx(cardClass, "p-4 sm:p-5")}>
      <div className="mb-4 flex items-center gap-2">
        {Icon ? <Icon aria-hidden className="h-4 w-4 text-[#007acc]" /> : null}
        <h2 className="text-sm font-semibold text-[#0A0A0A]">{title}</h2>
        {action ? <div className="ml-auto">{action}</div> : null}
      </div>
      {children}
    </div>
  );
}
