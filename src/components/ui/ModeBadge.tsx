"use client";

import { useContext } from "react";
import clsx from "clsx";
import { AppActionsContext } from "@/components/shell/AppContext";
import type { ScanMode } from "@/lib/types";

type Tone = "green" | "yellow" | "blue" | "rose" | "purple" | "gray";

const toneClasses: Record<Tone, string> = {
  green: "bg-green-50 text-green-700 border border-green-200",
  yellow: "bg-amber-50 text-amber-700 border border-amber-200",
  blue: "bg-[#E6F2FA] text-[#007acc] border border-[#B3D9EF]",
  rose: "bg-rose-50 text-rose-700 border border-rose-200",
  purple: "bg-purple-50 text-purple-700 border border-purple-200",
  gray: "bg-[#F5F5F5] text-[#444] border border-[#E0E0E0]"
};

const modeConfig: Record<string, { tone: Tone; en: string; zh: string }> = {
  Trend: { tone: "green", en: "Trend", zh: "趋势" },
  Event: { tone: "yellow", en: "Event", zh: "事件驱动" },
  MeanRevert: { tone: "blue", en: "Mean Revert", zh: "均值回归" },
  Sentiment: { tone: "rose", en: "Sentiment", zh: "情绪" },
  "Risk Scan": { tone: "yellow", en: "Risk Scan", zh: "风险扫描" },
  "Alpha Scan": { tone: "blue", en: "Alpha Scan", zh: "Alpha 扫描" },
  "DAO 尽调": { tone: "purple", en: "DAO Due Diligence", zh: "DAO 尽调" },
  Spot: { tone: "green", en: "Spot", zh: "现货" },
  Futures: { tone: "yellow", en: "Futures", zh: "合约" },
  DeFi: { tone: "purple", en: "DeFi", zh: "DeFi" }
};

export function ModeBadge({ mode }: { mode: ScanMode | string }) {
  const ctx = useContext(AppActionsContext);
  const language = ctx?.language ?? "en";
  const config = modeConfig[mode] ?? { tone: "gray" as Tone, en: mode, zh: mode };
  return (
    <span className={clsx("inline-flex items-center justify-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-semibold leading-none transition-colors", toneClasses[config.tone])}>
      {language === "zh" ? config.zh : config.en}
    </span>
  );
}
