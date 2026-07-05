"use client";

import clsx from "clsx";
import { Trophy } from "lucide-react";
import { PageHeading } from "@/components/ui/PageHeading";
import { cardClass } from "@/components/ui/styles";

const MASTERS = [
  { id: "buffett", nameZh: "巴菲特", nameEn: "Buffett", framework: "价值投资 · 护城河", initial: "B", color: "#10b981", tagline: "Margin of Safety" },
  { id: "soros", nameZh: "索罗斯", nameEn: "Soros", framework: "反身性 · 泡沫识别", initial: "S", color: "#ef4444", tagline: "Reflexivity" },
  { id: "dalio", nameZh: "达利欧", nameEn: "Dalio", framework: "原则 · 风险平价", initial: "D", color: "#f59e0b", tagline: "Risk Parity" },
  { id: "lynch", nameZh: "林奇", nameEn: "Lynch", framework: "GARP · 十倍股", initial: "L", color: "#0ea5e9", tagline: "Ten-Bagger" },
  { id: "livermore", nameZh: "利弗莫尔", nameEn: "Livermore", framework: "动量 · 关键点", initial: "J", color: "#f97316", tagline: "Pivotal Points" },
];

export function MemoryPage() {
  return (
    <section className="space-y-5">
      <PageHeading
        eyebrow="Master Track Record"
        title="大师战绩 · Master Track Record"
        description="每笔交易结束后，系统更新各位大师在各场景下的权重，影响未来裁决。"
      />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {MASTERS.map((m) => (
          <div key={m.id} className={clsx(cardClass, "p-4")}>
            <div className="flex items-start gap-3">
              <span
                className="grid h-11 w-11 shrink-0 place-items-center rounded-full text-base font-bold text-white"
                style={{ backgroundColor: m.color }}
              >
                {m.initial}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <h3 className="text-sm font-semibold text-gray-900">
                    {m.nameZh}
                    <span className="ml-1.5 text-[11px] font-normal text-gray-400">
                      {m.nameEn}
                    </span>
                  </h3>
                </div>
                <p className="mt-0.5 text-[11px] text-gray-500">
                  {m.framework} · {m.tagline}
                </p>
              </div>
            </div>
            <div className="mt-4">
              <div className="mb-1 flex items-center justify-between text-[11px]">
                <span className="text-gray-500">权重 Weight</span>
                <span className="font-mono font-semibold" style={{ color: m.color }}>
                  1.00
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-gray-100">
                <div
                  className="h-full rounded-full"
                  style={{ width: "50%", backgroundColor: m.color, opacity: 0.6 }}
                />
              </div>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center text-[11px]">
                <div>
                  <p className="text-gray-400">胜</p>
                  <p className="mt-0.5 font-semibold text-emerald-600">0</p>
                </div>
                <div>
                  <p className="text-gray-400">负</p>
                  <p className="mt-0.5 font-semibold text-red-600">0</p>
                </div>
                <div>
                  <p className="text-gray-400">胜率</p>
                  <p className="mt-0.5 font-semibold text-gray-900">—</p>
                </div>
              </div>
              <p className="mt-3 text-[11px] text-gray-400">等待首场分析…</p>
            </div>
          </div>
        ))}
      </div>

      <div className={clsx(cardClass, "p-5")}>
        <h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900">
          <Trophy className="h-4 w-4 text-blue-600" />
          权重更新机制
        </h3>
        <p className="mt-3 text-[13px] leading-6 text-gray-600">
          系统采用 Multiplicative Weights Update（乘法权重更新）：
          每当一笔交易结算（止盈或止损触发），根据方向是否预测正确，
          各位大师在该场景下的权重被乘以奖励系数或惩罚系数。
          上一阶段权重高的大师在下一次同场景裁决中话语权更大，模拟了真实市场里"赚钱者有话语权"的逻辑。
        </p>
      </div>
    </section>
  );
}
