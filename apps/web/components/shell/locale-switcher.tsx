"use client";

import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { useTransition } from "react";

// Native language names are never themselves translated — a language's own
// name is the same string regardless of the currently active locale.
const LOCALES = [
  { code: "en", label: "English" },
  { code: "zh-TW", label: "繁體中文" },
] as const;

export function LocaleSwitcher() {
  const locale = useLocale();
  const t = useTranslations("common");
  const router = useRouter();
  const [, startTransition] = useTransition();

  async function onChange(next: string) {
    document.cookie = `NEXT_LOCALE=${next}; path=/; max-age=31536000`;
    await fetch("/api/locale", { method: "PATCH", body: JSON.stringify({ locale: next }) });
    startTransition(() => router.refresh());
  }

  return (
    <select
      aria-label={t("language")}
      value={locale}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-md border border-border bg-transparent px-2 py-1 text-sm text-foreground"
    >
      {LOCALES.map((l) => (
        <option key={l.code} value={l.code}>{l.label}</option>
      ))}
    </select>
  );
}
