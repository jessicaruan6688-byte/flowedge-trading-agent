"use client";

import { useContext } from "react";
import clsx from "clsx";
import { AppActionsContext } from "@/components/shell/AppContext";

type Tone = "green" | "red" | "yellow" | "blue" | "purple" | "gray";

const toneClasses: Record<Tone, string> = {
  green: "bg-green-50 text-green-700 border border-green-200",
  red: "bg-red-50 text-red-700 border border-red-200",
  yellow: "bg-amber-50 text-amber-700 border border-amber-200",
  blue: "bg-[#E6F2FA] text-[#007acc] border border-[#B3D9EF]",
  purple: "bg-purple-50 text-purple-700 border border-purple-200",
  gray: "bg-[#F5F5F5] text-[#444] border border-[#E0E0E0]"
};

const dotTone: Record<Tone, string> = {
  green: "bg-green-500",
  red: "bg-red-500",
  yellow: "bg-amber-500",
  blue: "bg-[#007acc]",
  purple: "bg-purple-500",
  gray: "bg-[#A3A3A3]"
};

const statusConfig: Record<string, { tone: Tone; en: string; zh: string }> = {
  collecting: { tone: "gray", en: "Collecting", zh: "采集中" },
  pending: { tone: "yellow", en: "Pending", zh: "待处理" },
  waiting: { tone: "gray", en: "Waiting", zh: "等待中" },
  debating: { tone: "yellow", en: "Debating", zh: "辩论中" },
  judging: { tone: "blue", en: "Judging", zh: "裁决中" },
  strategizing: { tone: "blue", en: "Strategizing", zh: "策略中" },
  risk_check: { tone: "yellow", en: "Risk Check", zh: "风控中" },
  executing: { tone: "blue", en: "Executing", zh: "执行中" },
  running: { tone: "blue", en: "Running", zh: "运行中" },
  reviewing: { tone: "purple", en: "Reviewing", zh: "复盘中" },
  executed: { tone: "green", en: "Executed", zh: "已执行" },
  completed: { tone: "green", en: "Closed", zh: "已结案" },
  rejected: { tone: "red", en: "Rejected", zh: "驳回" },
  failed: { tone: "red", en: "Failed", zh: "失败" },
  error: { tone: "red", en: "Error", zh: "错误" },
  success: { tone: "green", en: "Success", zh: "成功" },
  Cancelled: { tone: "gray", en: "Cancelled", zh: "已取消" },
  已完成: { tone: "green", en: "Closed", zh: "已结案" },
  已上链: { tone: "purple", en: "Attested", zh: "已上链 ✓" },
  attested: { tone: "purple", en: "Attested", zh: "已上链 ✓" },
  未上链: { tone: "yellow", en: "Pending proof", zh: "待上链" }
};

export function StatusBadge({ status, withDot = true }: { status: string; withDot?: boolean }) {
  const ctx = useContext(AppActionsContext);
  const language = ctx?.language ?? "en";
  const config = statusConfig[status] ?? { tone: "gray" as Tone, en: status, zh: status };
  return (
    <span className={clsx("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors", toneClasses[config.tone])}>
      {withDot ? <span className={clsx("h-1.5 w-1.5 rounded-full", dotTone[config.tone])} /> : null}
      {language === "zh" ? config.zh : config.en}
    </span>
  );
}
