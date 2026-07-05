import { Suspense } from "react";
import DashboardApp from "@/components/DashboardApp";

export default function SettingsRoute() {
  return (
    <Suspense fallback={null}>
      <DashboardApp />
    </Suspense>
  );
}
