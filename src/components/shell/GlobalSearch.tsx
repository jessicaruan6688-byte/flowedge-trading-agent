"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { Search } from "lucide-react";
import { hkStockSymbols } from "@/lib/navigation";
import { useAppActions } from "./AppContext";

export function GlobalSearch() {
  const router = useRouter();
  const { language } = useAppActions();
  const copy = searchCopy[language];
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);

  const results = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return [];
    return hkStockSymbols
      .filter(
        (s) =>
          s.symbol.toLowerCase().includes(q) ||
          s.name.toLowerCase().includes(q)
      )
      .slice(0, 8);
  }, [query]);

  const showPanel = open && query.trim().length > 0;

  function openSymbol(symbol: string) {
    setQuery("");
    setOpen(false);
    setActiveIndex(0);
    router.push(`/court?symbol=${symbol}&mode=Spot&idea=`);
  }

  return (
    <div className="relative min-w-0 flex-1 md:max-w-xl">
      <label>
        <span className="sr-only">{copy.label}</span>
        <Search
          aria-hidden
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-[#737373]"
        />
        <input
          type="search"
          name="global-search"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            setActiveIndex(0);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setTimeout(() => setOpen(false), 200)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false);
              return;
            }
            if (!showPanel || results.length === 0) return;
            if (event.key === "ArrowDown") {
              event.preventDefault();
              setActiveIndex((current) => Math.min(current + 1, results.length - 1));
            }
            if (event.key === "ArrowUp") {
              event.preventDefault();
              setActiveIndex((current) => Math.max(current - 1, 0));
            }
            if (event.key === "Enter") {
              event.preventDefault();
              openSymbol(results[activeIndex].symbol);
            }
          }}
          className="w-full rounded-lg border border-[#E5E5E5] bg-white py-2 pl-9 pr-3 text-sm text-[#0A0A0A] placeholder:text-[#A3A3A3] transition-colors focus-visible:border-[#007acc] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#007acc]/20"
          placeholder={copy.placeholder}
          autoComplete="off"
          spellCheck={false}
        />
      </label>

      {showPanel ? (
        <div
          className="absolute left-0 top-11 z-40 w-full overflow-hidden rounded-lg border border-[#E5E5E5] bg-white shadow-lg"
        >
          <div className="max-h-96 overflow-auto p-2">
            {results.length === 0 ? (
              <div className="rounded-lg border border-dashed border-[#E5E5E5] bg-[#FAFAFA] px-3 py-4 text-sm text-[#737373]">
                <p className="font-medium text-[#0A0A0A]">{copy.empty}</p>
                <p className="mt-1 text-xs text-[#737373]">{copy.emptyDetail}</p>
              </div>
            ) : (
              <div className="grid gap-1">
                {results.map((stock, index) => (
                  <button
                    key={stock.symbol}
                    type="button"
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => openSymbol(stock.symbol)}
                    className={clsx(
                      "grid w-full grid-cols-[100px_1fr] gap-3 rounded-lg px-3 py-2 text-left transition-colors",
                      index === activeIndex ? "bg-[#F5F5F5]" : "hover:bg-[#F5F5F5]"
                    )}
                  >
                    <span className="font-mono text-sm font-semibold text-[#007acc]">
                      {stock.symbol}
                    </span>
                    <span className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-[#0A0A0A]">
                        {stock.name}
                      </span>
                    </span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}

const searchCopy = {
  en: {
    label: "Symbol search",
    placeholder: "Search HK stock code (e.g. 0700)...",
    empty: "No matching stock",
    emptyDetail: "Enter HK stock code like 0700, 3690, 9988"
  },
  zh: {
    label: "股票搜索",
    placeholder: "搜索港股代码（如 0700 腾讯、3690 美团）...",
    empty: "没有匹配结果",
    emptyDetail: "输入港股代码如 0700、3690、9988"
  }
} as const;
