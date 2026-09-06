"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Trace = {
  id: string; skillId: string; status: string; error: string | null;
  failedStep: string | null; failedInput: unknown; createdAt: string;
};

const STATUS_OPTIONS = ["all", "running", "done", "failed"] as const;

export default function TracesPage() {
  const t = useTranslations("traces");
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<(typeof STATUS_OPTIONS)[number]>("all");

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams();
    if (q) params.set("q", q);
    if (status !== "all") params.set("status", status);
    const qs = params.toString();
    fetch(`/api/traces${qs ? `?${qs}` : ""}`, { signal: controller.signal }).then(async (res) => {
      if (!res.ok) {
        setLoadError(t("error"));
        return;
      }
      setTraces(await res.json());
    }).catch((err) => {
      if ((err as Error).name !== "AbortError") setLoadError(t("error"));
    });
    return () => controller.abort();
  }, [t, q, status]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
      <div className="flex gap-2">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder={t("searchPlaceholder")}
          aria-label={t("searchPlaceholder")}
          className="rounded-md border border-border bg-transparent px-3 py-1.5 text-sm text-foreground"
        />
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as (typeof STATUS_OPTIONS)[number])}
          aria-label={t("statusFilter")}
          className="rounded-md border border-border bg-transparent px-2 py-1.5 text-sm text-foreground"
        >
          {STATUS_OPTIONS.map((s) => <option key={s} value={s}>{t(`status.${s}`)}</option>)}
        </select>
      </div>
      {loadError && <p className="inline-block rounded-md bg-danger px-3 py-1.5 text-sm text-pill-foreground">{loadError}</p>}
      <ul className="space-y-3">
        {traces.length === 0 ? (
          <li className="text-sm text-muted-foreground">{t("empty")}</li>
        ) : (
          traces.map((tr) => (
            <li key={tr.id} className="rounded-lg border border-border bg-card p-4 shadow-card">
              <p className="text-sm text-foreground">
                <span className="font-medium">{tr.skillId}</span> — {tr.status}
                {tr.failedStep ? ` (${t("failedAt", { step: tr.failedStep })})` : ""}
              </p>
              {tr.error && (
                <pre className="mt-2 rounded-md bg-danger p-2 text-xs text-pill-foreground">{tr.error}</pre>
              )}
              {tr.failedInput != null && (
                <pre className="mt-2 rounded-md bg-muted p-2 text-xs text-muted-foreground">
                  {JSON.stringify(tr.failedInput, null, 2)}
                </pre>
              )}
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
