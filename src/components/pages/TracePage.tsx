"use client";

import clsx from "clsx";
import { ShieldCheck, Activity } from "lucide-react";
import { PageHeading } from "@/components/ui/PageHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { cardClass } from "@/components/ui/styles";

export function TracePage() {
  return (
    <section className="space-y-5">
      <PageHeading
        eyebrow="Audit Trace"
        title="调用溯源 · Agent Trace"
        description="每一步 AI 调用、行情拉取、新闻/情绪查询都留下可审计的 trace，包括 latency、输入输出 hash、模型 provider 与错误原因。"
      />

      <div className="grid gap-4 md:grid-cols-4">
        <TraceMetric label="Trace 总数" value="0" />
        <TraceMetric label="成功" value="0" tone="green" />
        <TraceMetric label="失败/降级" value="0" tone="orange" />
        <TraceMetric label="平均延迟" value="—" tone="muted" />
      </div>

      <div className={clsx(cardClass)}>
        <EmptyState
          title="暂无 Trace"
          detail="启动一场庭审后，这里会展示完整的调用链时间线，含输入/输出预览与 hash。"
          icon={Activity}
        />
      </div>

      <div className="flex items-center gap-2 rounded-lg border border-[#E0E0E0] bg-white px-4 py-3 text-xs text-[#525252] shadow-sm">
        <ShieldCheck aria-hidden className="h-4 w-4 text-[#007acc]" />
        后续会展示时间线、输入/输出 JSON、Prompt/Output Hash 与 Headers 详情，支撑庭审裁决溯源。
      </div>
    </section>
  );
}

function TraceMetric({
  label,
  value,
  tone = "default",
}: {
  label: string;
  value: string;
  tone?: "default" | "green" | "orange" | "muted";
}) {
  const color = {
    default: "text-[#0A0A0A]",
    green: "text-[#22C55E]",
    orange: "text-[#F97316]",
    muted: "text-[#737373]",
  }[tone];
  return (
    <div className={clsx(cardClass, "p-4")}>
      <p className="text-[11px] font-medium uppercase tracking-wider text-[#737373]">
        {label}
      </p>
      <p className={clsx("mt-2 text-2xl font-semibold tracking-tight", color)}>{value}</p>
    </div>
  );
}
