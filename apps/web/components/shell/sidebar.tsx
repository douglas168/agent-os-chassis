"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NAV, NAV_GROUPS } from "./nav";
import { cn } from "@/lib/cn";

export function Sidebar() {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <aside className="flex w-[245px] shrink-0 flex-col border-r border-border bg-card">
      <div className="flex h-[65px] items-center px-4 text-lg font-semibold text-foreground">
        Agent OS
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group} className="mb-4">
            <div className="px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
              {t(`group.${group.toLowerCase()}`)}
            </div>
            {NAV.filter((item) => item.group === group).map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "flex items-center gap-2 rounded-md px-3 py-2 text-sm text-foreground hover:bg-accent",
                    active && "bg-primary/10 font-medium text-primary",
                  )}
                >
                  <Icon className="h-4 w-4" />
                  {t(item.labelKey)}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
