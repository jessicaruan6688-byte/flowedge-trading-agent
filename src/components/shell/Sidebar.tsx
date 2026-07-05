"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import {
  Activity,
  FolderClosed,
  Scale,
  Settings,
  Sparkles,
  TrendingUp,
  Trophy,
} from "lucide-react";
import { navigationItems } from "@/lib/navigation";
import type { PageKey } from "@/lib/types";
import { useAppActions } from "./AppContext";

const iconMap = {
  workspace: TrendingUp,
  court: Scale,
  cases: FolderClosed,
  memory: Trophy,
  trace: Activity,
  settings: Settings,
} satisfies Record<PageKey, typeof TrendingUp>;

const bottomHintKeys = [
  "shell.feature.debate",
  "shell.feature.judgeRisk",
  "shell.feature.precedent",
] as const;

export function Sidebar() {
  const pathname = usePathname();
  const { t } = useAppActions();

  return (
    <aside
      aria-label="Primary navigation"
      className="sticky top-0 hidden h-[100dvh] w-[260px] shrink-0 self-start overflow-y-auto border-r border-[#E5E5E5] bg-[#FAFAFA] px-3 py-4 thin-scrollbar lg:flex lg:flex-col"
    >
      {/* Brand */}
      <div className="flex items-center gap-3 px-2">
        <LogoMark />
        <div>
          <p className="text-sm font-semibold tracking-tight text-[#0A0A0A]">
            flow<span className="text-[#007acc]">Edge</span>
          </p>
          <p className="text-xs text-[#737373]">{t("shell.subtitle")}</p>
        </div>
      </div>

      {/* Nav */}
      <nav className="mt-6 flex-1 space-y-0.5">
        {navigationItems.map((item, index) => {
          const Icon = iconMap[item.key];
          const active =
            pathname === item.path ||
            pathname?.startsWith(`${item.path}/`) ||
            (item.key === "cases" && pathname?.startsWith("/case/"));
          return (
            <Link
              key={item.key}
              href={item.path}
              aria-current={active ? "page" : undefined}
              style={{ animationDelay: `${index * 40}ms` }}
              className={clsx(
                "animate-stagger group inline-flex w-full cursor-pointer items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007acc]/40",
                active
                  ? "bg-[#007acc]/10 text-[#007acc] ring-1 ring-[#007acc]/20"
                  : "text-[#444] hover:bg-[#F5F5F5] hover:text-[#0A0A0A]",
              )}
            >
              <span
                className={clsx(
                  "grid h-7 w-7 shrink-0 place-items-center rounded-md transition-colors",
                  active
                    ? "bg-[#007acc]/15 text-[#007acc]"
                    : "text-[#737373] group-hover:text-[#444]",
                )}
              >
                <Icon aria-hidden className="h-4 w-4" />
              </span>
              <span className="truncate">{t(`nav.${item.key}`)}</span>
              {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-[#007acc]" />}
            </Link>
          );
        })}
      </nav>

      {/* Feature hints */}
      <div className="mt-4 space-y-1 border-t border-[#E5E5E5] pt-4 px-2 text-xs text-[#737373]">
        {bottomHintKeys.map((key) => (
          <p key={key} className="flex items-center gap-1.5">
            <span className="h-1 w-1 rounded-full bg-[#007acc]/60" />
            {t(key)}
          </p>
        ))}
      </div>

      {/* Bottom CTA card */}
      <div className="mt-4 rounded-lg border border-[#007acc]/20 bg-[#007acc]/5 p-3">
        <div className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-white text-[#007acc] ring-1 ring-[#007acc]/20">
            <Sparkles aria-hidden className="h-3.5 w-3.5" />
          </span>
          <div className="min-w-0">
            <p className="text-xs font-semibold text-[#0A0A0A]">
              {t("shell.subtitle")}
            </p>
            <p className="truncate text-[11px] text-[#737373]">
              {pathname === "/" ? "" : "5 Masters · Risk-Verified"}
            </p>
          </div>
        </div>
      </div>
    </aside>
  );
}

function LogoMark() {
  return (
    <span className="relative grid h-9 w-9 place-items-center rounded-lg bg-[#007acc]/10 ring-1 ring-[#007acc]/20">
      <TrendingUp aria-hidden className="h-5 w-5 text-[#007acc]" strokeWidth={2.25} />
    </span>
  );
}
