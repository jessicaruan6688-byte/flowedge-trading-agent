"use client";

import Link from "next/link";
import clsx from "clsx";
import { ArrowRight, FileText } from "lucide-react";
import { PageHeading } from "@/components/ui/PageHeading";
import { EmptyState } from "@/components/ui/EmptyState";
import { buttonClass, cardClass } from "@/components/ui/styles";

export function CasesPage() {
  return (
    <section className="space-y-5">
      <PageHeading
        eyebrow="Case Files"
        title="交易卷宗 · Case Files"
        description="所有历史分析记录：标的、大师陈词、风控裁决、最终决策与订单结果，终身可查。"
      />
      <div className={clsx(cardClass, "p-8")}>
        <EmptyState
          title="暂无卷宗记录"
          detail="前往交易台提交分析请求，启动第一场庭审。每一次裁决都会生成一份卷宗。"
          icon={FileText}
        />
        <div className="mt-4 flex justify-center">
          <Link href="/workspace" className={buttonClass}>
            <FileText className="h-4 w-4" />
            去交易台
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
