"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

type EntityViewData = {
  id: string; skillId: string; title: string; subtitle?: string;
  fields: { label: string; value: string }[];
  stages: { key: string; label: string }[]; currentStage: string;
  runs: {
    id: string; orgId: string; skillId: string; messageId: string | null;
    mastraRunId: string; status: string; intent: unknown; entityRef: unknown;
    error: string | null; failedStep: string | null; failedInput: unknown;
    createdAt: string; updatedAt: string;
  }[];
};

export default function WorkEntityPage() {
  const params = useParams<{ entityId: string }>();
  const t = useTranslations("workEntity");
  const [view, setView] = useState<EntityViewData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/work/${params.entityId}`).then(async (res) => {
      if (res.status === 404) { setNotFound(true); return; }
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : t("error");
        setError(message);
        return;
      }
      setView(await res.json());
    });
  }, [params.entityId]);

  if (notFound) return <p className="text-sm text-foreground">{t("notFound")}</p>;
  if (error) {
    return (
      <p className="inline-block rounded-md bg-danger px-3 py-1.5 text-sm text-pill-foreground">{error}</p>
    );
  }
  if (!view) return <p className="text-sm text-muted-foreground">{t("loading")}</p>;

  return (
    <div className="grid gap-6 xl:grid-cols-2">
      <div className="space-y-4 rounded-lg border border-border bg-card p-4 shadow-card">
        <div>
          <h1 className="text-lg font-semibold text-foreground">{view.title}</h1>
          {view.subtitle && <p className="text-sm text-muted-foreground">{view.subtitle}</p>}
        </div>
        <ol className="flex flex-wrap gap-2">
          {view.stages.map((s) => (
            <li
              key={s.key}
              className={cn(
                "rounded-full px-3 py-1 text-xs",
                s.key === view.currentStage
                  ? "bg-primary font-medium text-primary-foreground"
                  : "bg-muted text-muted-foreground",
              )}
            >
              {s.label}
            </li>
          ))}
        </ol>
        <ul className="space-y-1 text-sm text-foreground">
          {view.fields.map((f) => (
            <li key={f.label}><span className="text-muted-foreground">{f.label}:</span> {f.value}</li>
          ))}
        </ul>
      </div>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("runs")}</h2>
        <ul className="space-y-2">
          {view.runs.map((r) => (
            <li key={r.id} className="rounded-lg border border-border bg-card p-3 text-sm shadow-card">
              {r.status} — {r.createdAt}
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
