import { Suspense } from "react";
import DashboardApp from "@/components/DashboardApp";

export default function CasesRoute() {
  return (
    <Suspense fallback={null}>
      <DashboardApp />
    </Suspense>
  );
}
