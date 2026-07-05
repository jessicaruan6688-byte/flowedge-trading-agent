"use client";

import Link from "next/link";
import clsx from "clsx";
import { ArrowLeft } from "lucide-react";
import { PageHeading } from "@/components/ui/PageHeading";
import { buttonClass, cardClass } from "@/components/ui/styles";

interface CaseDetailPageProps {
  caseId: string;
}

export function CaseDetailPage({ caseId }: CaseDetailPageProps) {
  return (
    <section className="space-y-5">
      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
        <Link href="/cases" className={clsx(buttonClass, "!min-h-8 !px-2.5 !py-1 !text-xs")}>
          <ArrowLeft className="h-3.5 w-3.5" />
          返回卷宗列表
        </Link>
      </div>
      <PageHeading
        eyebrow="Case Detail"
        title={`案件详情 · ${caseId}`}
        description="完整庭审记录：五大师陈词、风控评估、最终裁决、订单执行结果。"
      />
      <div className={clsx(cardClass, "p-5")}>
        <p className="text-sm text-slate-400">
          Case <span className="font-mono text-amber-300">{caseId}</span> 详情待后端接入后渲染。
        </p>
      </div>
    </section>
  );
}
