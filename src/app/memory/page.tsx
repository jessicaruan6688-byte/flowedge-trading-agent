import { Suspense } from "react";
import DashboardApp from "@/components/DashboardApp";

export default function MemoryRoute() {
  return (
    <Suspense fallback={null}>
      <DashboardApp />
    </Suspense>
  );
}
