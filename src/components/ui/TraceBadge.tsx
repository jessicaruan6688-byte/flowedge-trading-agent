"use client";

import { useContext } from "react";
import clsx from "clsx";
import { AppActionsContext } from "@/components/shell/AppContext";
import type { TraceStatus } from "@/lib/types";

const traceConfig: Record<TraceStatus, { cls: string; en: string; zh: string }> = {
  success: { cls: "bg-green-50 text-green-700 border border-green-200", en: "success", zh: "成功" },
  failed: { cls: "bg-red-50 text-red-700 border border-red-200", en: "failed", zh: "失败" },
  running: { cls: "bg-[#E6F2FA] text-[#007acc] border border-[#B3D9EF]", en: "running", zh: "运行中" },
  fallback: { cls: "bg-amber-50 text-amber-700 border border-amber-200", en: "fallback", zh: "降级" }
};

const extraConfig: Record<string, { cls: string; en: string; zh: string }> = {
  live: { cls: "bg-green-50 text-green-700 border border-green-200", en: "live", zh: "实时" },
  error: { cls: "bg-red-50 text-red-700 border border-red-200", en: "error", zh: "错误" },
  mock: { cls: "bg-amber-50 text-amber-700 border border-amber-200", en: "mock", zh: "模拟" }
};

export function TraceBadge({ status }: { status: TraceStatus | string }) {
  const ctx = useContext(AppActionsContext);
  const language = ctx?.language ?? "en";
  const config = (traceConfig as Record<string, { cls: string; en: string; zh: string }>)[status] ?? extraConfig[status] ?? traceConfig.fallback;
  return (
    <span className={clsx("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-semibold transition-colors", config.cls)}>
      {language === "zh" ? config.zh : config.en}
    </span>
  );
}
