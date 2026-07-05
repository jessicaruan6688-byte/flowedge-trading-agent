"use client";

import { useParams } from "next/navigation";
import { Suspense } from "react";
import DashboardApp from "@/components/DashboardApp";

export default function CaseDetailRoute() {
  const params = useParams<{ id: string }>();
  return (
    <Suspense fallback={null}>
      <DashboardApp caseId={params.id} />
    </Suspense>
  );
}
