"use client";

import { Search } from "lucide-react";
import { useTranslations } from "next-intl";
import { ThemeToggle } from "@/components/theme-toggle";
import { LocaleSwitcher } from "@/components/shell/locale-switcher";

export function Topbar() {
  const t = useTranslations("common");

  return (
    <header className="flex h-[65px] items-center justify-between border-b border-border bg-card px-6">
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Search className="h-4 w-4" />
        <input
          type="search"
          placeholder={t("search")}
          aria-label={t("globalSearch")}
          disabled
          title={t("searchComingLater")}
          className="w-64 bg-transparent text-sm text-foreground placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
        />
      </div>
      <div className="flex items-center gap-3">
        <LocaleSwitcher />
        <ThemeToggle />
      </div>
    </header>
  );
}
