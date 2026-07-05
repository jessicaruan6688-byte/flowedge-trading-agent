"use client";

import { usePathname } from "next/navigation";
import { pageKeyFromPath } from "@/lib/navigation";
import { AppShell } from "./shell/AppShell";
import { WorkspacePage } from "./pages/WorkspacePage";
import { CourtPage } from "./pages/CourtPage";
import { CasesPage } from "./pages/CasesPage";
import { CaseDetailPage } from "./pages/CaseDetailPage";
import { MemoryPage } from "./pages/MemoryPage";
import { TracePage } from "./pages/TracePage";
import { SettingsPage } from "./pages/SettingsPage";

interface DashboardAppProps {
  /** When rendered from the /case/[id] route the page passes the parsed id. */
  caseId?: string;
}

export default function DashboardApp({ caseId }: DashboardAppProps) {
  const pathname = usePathname();
  const pageKey = pageKeyFromPath(pathname);

  // /case/:id -> render the detail view inside the shell instead of the case list.
  const isCaseDetail =
    Boolean(caseId) || (pathname !== "/cases" && /^\/case\/[^/]+\/?$/.test(pathname));

  const resolvedId =
    caseId ??
    (isCaseDetail ? pathname.replace(/^\/case\//, "").replace(/\/$/, "") : undefined);

  let page: React.ReactNode;
  if (isCaseDetail && resolvedId) {
    page = <CaseDetailPage caseId={resolvedId} />;
  } else {
    page = {
      workspace: <WorkspacePage />,
      court: <CourtPage />,
      cases: <CasesPage />,
      memory: <MemoryPage />,
      trace: <TracePage />,
      settings: <SettingsPage />,
    }[pageKey] ?? <WorkspacePage />;
  }

  return <AppShell>{page}</AppShell>;
}
