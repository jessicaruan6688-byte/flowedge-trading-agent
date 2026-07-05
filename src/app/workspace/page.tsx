import { Suspense } from "react";
import DashboardApp from "@/components/DashboardApp";

export default function WorkspaceRoute() {
  return (
    <Suspense fallback={null}>
      <DashboardApp />
    </Suspense>
  );
}
