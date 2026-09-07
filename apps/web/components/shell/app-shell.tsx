import type { ReactNode } from "react";
import { Sidebar } from "./sidebar";
import { Topbar } from "./topbar";

type Counts = { approvals?: number; jobs?: number; inbox?: number };

export function AppShell({ children, orgName, counts, isAdmin }: { children: ReactNode; orgName?: string; counts?: Counts; isAdmin?: boolean }) {
  return (
    <div className="flex h-screen bg-background">
      <Sidebar counts={counts} isAdmin={isAdmin} />
      <div className="flex min-h-0 min-w-0 flex-1 flex-col">
        <Topbar orgName={orgName} />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
