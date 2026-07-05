"use client";

import { useContext } from "react";
import clsx from "clsx";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { AppActionsContext } from "@/components/shell/AppContext";

type Tone = "bull" | "bear" | "hold";

const verdictConfig: Record<string, { tone: Tone; en: string; zh: string }> = {
  POSITIVE: { tone: "bull", en: "BULLISH", zh: "看多" },
  BULL_BUY: { tone: "bull", en: "BUY", zh: "做多" },
  LONG: { tone: "bull", en: "LONG", zh: "做多" },
  BUY: { tone: "bull", en: "BUY", zh: "买入" },
  OBSERVE: { tone: "hold", en: "OBSERVE", zh: "观察" },
  HOLD: { tone: "hold", en: "HOLD", zh: "观望" },
  NEUTRAL: { tone: "hold", en: "NEUTRAL", zh: "中性" },
  CAUTION: { tone: "hold", en: "CAUTION", zh: "谨慎" },
  REDUCE: { tone: "bear", en: "REDUCE", zh: "减仓" },
  REDUCE_POSITION: { tone: "bear", en: "REDUCE", zh: "减仓" },
  NEGATIVE: { tone: "bear", en: "BEARISH", zh: "看空" },
  BEAR_SELL: { tone: "bear", en: "SELL", zh: "做空" },
  SHORT: { tone: "bear", en: "SHORT", zh: "做空" },
  SELL: { tone: "bear", en: "SELL", zh: "卖出" },
  REJECT: { tone: "hold", en: "REJECT", zh: "驳回" },
  REJECTED: { tone: "hold", en: "REJECTED", zh: "驳回" }
};

const toneClasses: Record<Tone, string> = {
  bull: "bg-green-50 text-green-700 border border-green-200",
  bear: "bg-red-50 text-red-700 border border-red-200",
  hold: "bg-[#F5F5F5] text-[#444] border border-[#E0E0E0]"
};

export function VerdictBadge({ verdict, size = "md" }: { verdict: string; size?: "sm" | "md" | "lg" }) {
  const ctx = useContext(AppActionsContext);
  const language = ctx?.language ?? "en";
  const config = verdictConfig[verdict] ?? verdictConfig.OBSERVE;
  const Icon = config.tone === "bull" ? ArrowUp : config.tone === "bear" ? ArrowDown : Minus;

  const sizeCls =
    size === "lg"
      ? "px-3 py-1.5 text-sm gap-1.5"
      : size === "sm"
        ? "px-2 py-0.5 text-[11px] gap-1"
        : "px-2.5 py-1 text-xs gap-1";

  return (
    <span className={clsx("inline-flex items-center rounded-full font-semibold transition-colors", toneClasses[config.tone], sizeCls)}>
      <Icon aria-hidden className={size === "lg" ? "h-4 w-4" : "h-3 w-3"} />
      {language === "zh" ? config.zh : config.en}
    </span>
  );
}
