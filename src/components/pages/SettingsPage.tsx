"use client";

import clsx from "clsx";
import { Settings as SettingsIcon } from "lucide-react";
import { PageHeading } from "@/components/ui/PageHeading";
import { cardClass } from "@/components/ui/styles";

export function SettingsPage() {
  return (
    <section className="space-y-5">
      <PageHeading
        eyebrow="Settings"
        title="设置 · Settings"
        description="模型配置、数据源、回放速度、初始资金与其他运行参数。"
      />

      <div className="grid gap-5 xl:grid-cols-[1fr_340px]">
        <div className="grid gap-4">
          <SettingsGroup title="模型配置" subtitle="五大师模型路由（默认使用豆包 Doubao）">
            <SettingsRow label="Buffett / Lynch / Livermore" value="doubao-seed-2-1-pro" />
            <SettingsRow label="Soros (宏观推理)" value="doubao-seed-2-1-pro" />
            <SettingsRow label="Dalio (风控)" value="doubao-seed-2-1-pro" />
            <SettingsRow label="Embedding 模型" value="doubao-embedding-text" muted />
          </SettingsGroup>

          <SettingsGroup title="数据源" subtitle="港股行情、新闻与情绪">
            <SettingsRow label="行情源" value="QVeris / 新浪财经（mock）" />
            <SettingsRow label="新闻源" value="新浪财经 / 财联社" />
            <SettingsRow label="情绪源" value="社交媒体+新闻情绪模型" />
            <SettingsRow label="数据模式" value="mock（Demo）" muted />
          </SettingsGroup>

          <SettingsGroup title="回放 & 交易参数">
            <SettingsRow label="回放速度" value="60x" />
            <SettingsRow label="初始模拟资金" value="HK$ 1,000,000" />
            <SettingsRow label="单笔最大仓位" value="10% 组合" />
            <SettingsRow label="个股止损线" value="-6%" tone="bear" />
            <SettingsRow label="止盈线" value="+12%" tone="bull" />
          </SettingsGroup>
        </div>

        <aside className="space-y-4">
          <div className={clsx(cardClass, "p-4")}>
            <div className="flex items-center gap-2 text-sm font-semibold text-[#0A0A0A]">
              <SettingsIcon aria-hidden className="h-4 w-4 text-[#007acc]" />
              运行时状态
            </div>
            <div className="mt-3 space-y-2 text-xs">
              <StatusRow label="Doubao API" value="ready" ok />
              <StatusRow label="行情 Mock" value="enabled" ok />
              <StatusRow label="SSE 流" value="ready" ok />
              <StatusRow label="大师权重" value="default" ok />
              <StatusRow label="判例库" value="empty" />
            </div>
          </div>

          <div className={clsx(cardClass, "p-4 text-[13px] leading-6 text-[#525252]")}>
            <h3 className="text-sm font-semibold text-[#0A0A0A]">Demo 提示</h3>
            <p className="mt-2">
              当前为 Hackathon Demo 版本。若{" "}
              <code className="rounded bg-[#F5F5F5] px-1 py-0.5 font-mono text-[12px] text-[#007acc]">
                /api/court/run
              </code>{" "}
              尚未接入，法庭页会自动启用模拟流，演示 5 位大师依次陈词和最终裁决的完整动画效果。
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

function SettingsGroup({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={clsx(cardClass, "p-4 sm:p-5")}>
      <div className="border-b border-[#F0F0F0] pb-3">
        <h3 className="text-sm font-semibold text-[#0A0A0A]">{title}</h3>
        {subtitle ? <p className="mt-1 text-xs text-[#737373]">{subtitle}</p> : null}
      </div>
      <div className="mt-3 divide-y divide-[#F5F5F5]">{children}</div>
    </div>
  );
}

function SettingsRow({
  label,
  value,
  muted,
  tone,
}: {
  label: string;
  value: string;
  muted?: boolean;
  tone?: "bull" | "bear";
}) {
  const valueColor = muted
    ? "text-[#A3A3A3]"
    : tone === "bull"
    ? "text-[#22C55E]"
    : tone === "bear"
    ? "text-[#EF4444]"
    : "text-[#007acc]";
  return (
    <div className="flex items-center justify-between py-2.5 text-sm">
      <span className="text-[#0A0A0A]">{label}</span>
      <span className={clsx("font-mono text-xs", valueColor)}>{value}</span>
    </div>
  );
}

function StatusRow({ label, value, ok }: { label: string; value: string; ok?: boolean }) {
  return (
    <div className="flex items-center justify-between rounded-md bg-[#FAFAFA] px-3 py-2 ring-1 ring-[#EFEFEF]">
      <span className="text-[#525252]">{label}</span>
      <span
        className={clsx(
          "rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1",
          ok
            ? "bg-[#22C55E]/10 text-[#15803D] ring-[#22C55E]/20"
            : "bg-[#F59E0B]/10 text-[#B45309] ring-[#F59E0B]/20",
        )}
      >
        {value}
      </span>
    </div>
  );
}
