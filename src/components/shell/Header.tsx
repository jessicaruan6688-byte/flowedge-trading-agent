"use client";

import { Bell, Languages, Wallet } from "lucide-react";
import { GlobalSearch } from "./GlobalSearch";
import { useAppActions } from "./AppContext";

function formatHkd(value: number): string {
  return `HK$ ${Math.round(value).toLocaleString("en-US")}`;
}

export function Header() {
  const { language, t, toggleLanguage, portfolioBalance } = useAppActions();

  return (
    <header className="sticky top-0 z-30 border-b border-[#E5E5E5] bg-white/90 px-4 py-2.5 backdrop-blur sm:px-6 sm:py-3 lg:px-8">
      <div className="mx-auto flex max-w-[1400px] items-center gap-2 md:justify-between">
        <GlobalSearch />
        <div className="flex shrink-0 items-center gap-2">
          <span className="hidden items-center gap-2 rounded-full bg-[#22C55E]/10 px-3 py-1 text-xs font-medium text-[#15803D] ring-1 ring-[#22C55E]/20 md:inline-flex">
            <span className="h-2 w-2 animate-pulse rounded-full bg-[#22C55E]" />
            {t("header.operational")}
          </span>

          {/* Portfolio value (paper trading) */}
          <div
            className="inline-flex h-10 shrink-0 items-center gap-2 rounded-md border border-[#E5E5E5] bg-white px-3 text-sm font-semibold text-[#0A0A0A] shadow-sm"
            aria-label={t("header.portfolioValue")}
            title={t("header.portfolioValue")}
          >
            <Wallet aria-hidden className="h-4 w-4 text-[#007acc]" />
            <span className="hidden font-mono text-xs text-[#737373] sm:inline">
              {t("header.portfolioValue")}
            </span>
            <span className="font-mono text-[#0A0A0A]">{formatHkd(portfolioBalance)}</span>
          </div>

          <button
            className="inline-flex h-10 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-md border border-[#E5E5E5] bg-white px-3 text-sm font-medium text-[#444] shadow-sm transition-colors duration-150 hover:border-[#007acc] hover:text-[#007acc] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007acc]/15"
            type="button"
            aria-label={t("language.switch")}
            onClick={toggleLanguage}
            data-language={language}
          >
            <Languages aria-hidden className="h-4 w-4" />
            <span>{t("language.next")}</span>
          </button>

          <button
            className="hidden h-10 w-10 cursor-pointer items-center justify-center rounded-md border border-[#E5E5E5] bg-white text-[#444] shadow-sm transition-colors duration-150 hover:border-[#007acc] hover:text-[#007acc] focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-[#007acc]/15 sm:inline-flex"
            type="button"
            aria-label={t("header.notifications")}
          >
            <Bell aria-hidden className="h-4 w-4" />
          </button>

          <div className="hidden items-center gap-2 rounded-md border border-[#E5E5E5] bg-white px-2 py-1.5 shadow-sm xl:flex">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-blue-50 text-xs font-bold text-[#007acc] ring-1 ring-blue-200">
              f
            </span>
            <div>
              <p className="text-xs font-semibold text-[#0A0A0A]">flowEdge</p>
              <p className="text-[11px] text-[#737373]">{t("header.operatorWorkspace")}</p>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
}
