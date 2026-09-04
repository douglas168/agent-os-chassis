"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";

type Trace = {
  id: string; skillId: string; status: string; error: string | null;
  failedStep: string | null; failedInput: unknown; createdAt: string;
};

export default function TracesPage() {
  const t = useTranslations("traces");
  const [traces, setTraces] = useState<Trace[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/traces").then(async (res) => {
      if (!res.ok) {
        setLoadError(t("error"));
        return;
      }
      setTraces(await res.json());
    });
  }, [t]);

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
      {loadError && <p className="text-sm text-danger">{loadError}</p>}
      <ul className="space-y-3">
        {traces.map((tr) => (
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
        ))}
      </ul>
    </div>
  );
}
