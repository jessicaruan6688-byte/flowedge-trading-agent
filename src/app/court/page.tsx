import { Suspense } from "react";
import DashboardApp from "@/components/DashboardApp";

export default function CourtRoute() {
  return (
    <Suspense fallback={null}>
      <DashboardApp />
    </Suspense>
  );
}
