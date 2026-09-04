import {
  Activity,
  Blocks,
  Brain,
  Building2,
  Clock,
  Cog,
  Inbox,
  LayoutDashboard,
  ListChecks,
  MessagesSquare,
  ShieldCheck,
  Users,
  type LucideIcon,
} from "lucide-react";

export type NavGroup = "Work" | "Intelligence" | "Build" | "Manage";

export interface NavItem {
  href: string;
  labelKey: string;
  icon: LucideIcon;
  group: NavGroup;
}

export const NAV_GROUPS: readonly NavGroup[] = ["Work", "Intelligence", "Build", "Manage"];

export const NAV: readonly NavItem[] = [
  { href: "/chat", labelKey: "chat", icon: MessagesSquare, group: "Work" },
  { href: "/dashboard", labelKey: "dashboard", icon: LayoutDashboard, group: "Work" },
  { href: "/approvals", labelKey: "approvals", icon: ShieldCheck, group: "Work" },
  { href: "/work", labelKey: "work", icon: ListChecks, group: "Work" },
  { href: "/jobs", labelKey: "jobs", icon: Clock, group: "Work" },
  { href: "/inbox", labelKey: "inbox", icon: Inbox, group: "Work" },
  { href: "/brain", labelKey: "brain", icon: Brain, group: "Intelligence" },
  { href: "/traces", labelKey: "traces", icon: Activity, group: "Intelligence" },
  { href: "/skills", labelKey: "skills", icon: Blocks, group: "Build" },
  { href: "/admin/users", labelKey: "adminUsers", icon: Users, group: "Manage" },
  { href: "/admin/org", labelKey: "adminOrg", icon: Building2, group: "Manage" },
  { href: "/admin/llm", labelKey: "adminLlm", icon: Cog, group: "Manage" },
];
