"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useTranslations } from "next-intl";
import { NAV, NAV_GROUPS } from "./nav";
import { cn } from "@/lib/cn";

const COUNTED_KEYS = ["approvals", "jobs", "inbox"] as const;
type CountedKey = (typeof COUNTED_KEYS)[number];

export function Sidebar({ counts }: { counts?: Partial<Record<CountedKey, number>> }) {
  const pathname = usePathname();
  const t = useTranslations("nav");

  return (
    <aside className="flex w-16 shrink-0 flex-col border-r border-border bg-card xl:w-[245px]">
      <div
        className="flex h-[65px] items-center justify-center px-4 text-lg font-semibold text-foreground xl:justify-start"
        aria-label="Agent OS"
      >
        <span className="xl:hidden" aria-hidden="true">OS</span>
        <span className="hidden xl:inline" aria-hidden="true">Agent OS</span>
      </div>
      <nav className="flex-1 overflow-y-auto px-2 py-2">
        {NAV_GROUPS.map((group) => (
          <div key={group} className="mb-4">
            <div className="hidden px-3 py-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground xl:block">
              {t(`group.${group.toLowerCase()}`)}
            </div>
            {NAV.filter((item) => item.group === group).map((item) => {
              const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
              const Icon = item.icon;
              const countedKey = item.href.slice(1) as CountedKey;
              const count = COUNTED_KEYS.includes(countedKey) ? counts?.[countedKey] : undefined;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  aria-current={active ? "page" : undefined}
                  aria-label={t(item.labelKey)}
                  className={cn(
                    "flex items-center justify-center gap-1 rounded-md px-0 py-2 text-sm text-foreground hover:bg-accent xl:justify-between xl:gap-2 xl:px-3",
                    active && "bg-primary font-medium text-primary-foreground hover:bg-primary",
                  )}
                >
                  <span className="flex items-center gap-1">
                    <Icon className="h-4 w-4 shrink-0" />
                    <span className="hidden xl:inline">{t(item.labelKey)}</span>
                  </span>
                  {!!count && (
                    <span className="shrink-0 rounded-full bg-danger px-1.5 py-0.5 text-[10px] text-pill-foreground xl:px-2 xl:py-0.5 xl:text-xs">
                      {count}
                    </span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </nav>
    </aside>
  );
}
