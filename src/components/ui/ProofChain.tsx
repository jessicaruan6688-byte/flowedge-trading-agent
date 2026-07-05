"use client";

import clsx from "clsx";
import { FileJson, Fingerprint, Network, PackageCheck, Search, ShieldCheck } from "lucide-react";
import { useAppActions } from "@/components/shell/AppShell";
import { cardClass } from "./styles";

export interface ProofChainProps {
  topic: string;
  mode: string;
  actions: string[];
  evidenceCount: number;
  reportHash: string;
  evidenceHash: string;
  txHash?: string;
  attested: boolean;
  compact?: boolean;
}

export function ProofChain({
  topic,
  mode,
  actions,
  evidenceCount,
  reportHash,
  evidenceHash,
  txHash,
  attested,
  compact = false
}: ProofChainProps) {
  let language: "en" | "zh" = "en";
  try {
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const ctx = useAppActions();
    language = ctx.language;
  } catch {
    // outside AppShell
  }

  const isZh = language === "zh";
  const nodes = [
    {
      label: isZh ? "用户查询" : "User Query",
      detail: `${topic} / ${mode}`,
      status: isZh ? "意图解析" : "intent parsed",
      icon: Search
    },
    {
      label: "xAPI Actions",
      detail: actions.length > 0 ? actions.slice(0, 2).join(", ") : (isZh ? "已发现动作" : "actions discovered"),
      status: isZh ? `${actions.length} 个动作` : `${actions.length} actions`,
      icon: Network
    },
    {
      label: isZh ? "证据包" : "Evidence Packet",
      detail: isZh ? "规范化证据" : "normalized evidence",
      status: isZh ? `${evidenceCount} 条证据` : `${evidenceCount} evidence items`,
      icon: PackageCheck
    },
    {
      label: "Report JSON",
      detail: isZh ? "风险、Alpha、推理" : "risk, alpha, rationale",
      status: isZh ? "报告已生成" : "report generated",
      icon: FileJson
    },
    {
      label: isZh ? "报告哈希 / 证据哈希" : "Report Hash / Evidence Hash",
      detail: `${shortHash(reportHash)} / ${shortHash(evidenceHash)}`,
      status: reportHash && evidenceHash ? (isZh ? "哈希就绪" : "hash ready") : (isZh ? "哈希等待中" : "hash pending"),
      icon: Fingerprint
    },
    {
      label: isZh ? "链上证明" : "On-chain Attestation",
      detail: txHash ? shortHash(txHash) : (isZh ? "等待交易" : "waiting for tx"),
      status: attested ? (isZh ? "已确认" : "tx confirmed") : (isZh ? "未上链" : "not attested"),
      icon: ShieldCheck
    }
  ];

  return (
    <div className={clsx(cardClass, compact ? "p-3 sm:p-4" : "p-4 sm:p-5")}>
      <div className="flex items-center justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-[#0A0A0A]">
            {compact ? (isZh ? "证明链摘要" : "Proof Chain Summary") : (isZh ? "证明链" : "Proof Chain")}
          </h2>
          <p className="mt-1 text-xs text-[#737373]">
            {isZh ? "用户意图 → xAPI 证据 → 报告哈希 → 链上证明。" : "User intent → xAPI evidence → report hashes → on-chain proof."}
          </p>
        </div>
        <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold border", attested ? "bg-green-50 text-green-700 border-green-200" : "bg-amber-50 text-amber-700 border-amber-200")}>
          {attested ? (isZh ? "已上链" : "Attested") : (isZh ? "草稿" : "Draft")}
        </span>
      </div>
      <div className="relative mt-5 pb-1">
        <div className="absolute left-[8%] right-[8%] top-5 hidden h-px bg-[#E5E5E5] xl:block" aria-hidden />
        <ol className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-6">
          {nodes.map((node, index) => {
            const Icon = node.icon;
            const isLast = index === nodes.length - 1;
            const isDone = isLast ? attested : true;
            return (
              <li key={node.label} className="relative grid grid-cols-[44px_1fr] gap-3 rounded-lg border border-[#E5E5E5] bg-[#FAFAFA] p-3 xl:grid-cols-1 xl:border-0 xl:bg-transparent xl:p-0 xl:text-center">
                <span
                  className={clsx(
                    "relative z-10 grid h-10 w-10 place-items-center rounded-full border bg-white shadow-sm xl:mx-auto",
                    isDone
                      ? isLast && attested
                        ? "border-green-300 text-green-600 ring-4 ring-green-100"
                        : "border-[#B3D9EF] text-[#007acc] ring-4 ring-[#E6F2FA]"
                      : "border-[#E5E5E5] text-[#A3A3A3]"
                  )}
                >
                  <Icon aria-hidden className="h-4 w-4" />
                </span>
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-[#0A0A0A]">{node.label}</p>
                  <p className="mt-1 text-[10px] font-semibold uppercase tracking-wider text-[#737373]">{node.status}</p>
                  <p className="mono mt-1 truncate text-xs text-[#737373]" spellCheck={false}>
                    {node.detail}
                  </p>
                </div>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}

function shortHash(value?: string) {
  if (!value) return "pending";
  return `${value.slice(0, 8)}...${value.slice(-6)}`;
}
