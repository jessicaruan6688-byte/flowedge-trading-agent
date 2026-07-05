import { Suspense } from "react";
import DashboardApp from "@/components/DashboardApp";

export default function TraceRoute() {
  return (
    <Suspense fallback={null}>
      <DashboardApp />
    </Suspense>
  );
}
