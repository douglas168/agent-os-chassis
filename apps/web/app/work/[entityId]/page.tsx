"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";
import { ApprovalCard, type ActionWithMeta } from "@/components/approval-card";
import { RunPanel, type RunPanelData } from "@/components/run-panel";

type EntityViewData = {
  id: string; skillId: string; title: string; subtitle?: string;
  fields: { label: string; value: string }[];
  stages: { key: string; label: string }[]; currentStage: string;
  runs: RunPanelData[];
  contact: { id: string; name: string; company: string | null } | null;
  documents: { id: string; title: string; mime: string; sizeBytes: number }[];
  pendingActions: ActionWithMeta[];
};

export default function WorkEntityPage() {
  const params = useParams<{ entityId: string }>();
  const t = useTranslations("workEntity");
  const [view, setView] = useState<EntityViewData | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [decidingId, setDecidingId] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch(`/api/work/${params.entityId}`);
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
  }

  useEffect(() => { refresh(); }, [params.entityId]);

  async function decide(id: string, decision: "approved" | "denied") {
    setDecidingId(id);
    try {
      await fetch(`/api/actions/${id}`, { method: "PATCH", body: JSON.stringify({ decision }) });
      await refresh();
    } finally {
      setDecidingId(null);
    }
  }

  async function edit(id: string, draft: Record<string, unknown>) {
    await fetch(`/api/actions/${id}/edit`, { method: "POST", body: JSON.stringify({ draft }) });
    await refresh();
  }

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
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("contact")}</h2>
          {view.contact ? (
            <p className="text-sm text-foreground">
              {view.contact.name}{view.contact.company ? ` — ${view.contact.company}` : ""}
            </p>
          ) : (
            <p className="text-sm text-muted-foreground">{t("noContact")}</p>
          )}
        </div>
        <div>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("documents")}</h2>
          {view.documents.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("noDocuments")}</p>
          ) : (
            <ul className="space-y-1 text-sm text-foreground">
              {view.documents.map((document) => <li key={document.id}>{document.title}</li>)}
            </ul>
          )}
        </div>
      </div>
      <div className="space-y-3">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">{t("runs")}</h2>
        {view.pendingActions.length > 0 && (
          <ul className="space-y-2">
            {view.pendingActions.map((action) => (
              <ApprovalCard
                key={action.id}
                action={action}
                onDecide={decide}
                onEdit={edit}
                deciding={decidingId === action.id}
              />
            ))}
          </ul>
        )}
        <ul className="space-y-2">
          {view.runs.length === 0 ? (
            <li className="text-sm text-muted-foreground">{t("runsEmpty")}</li>
          ) : (
            view.runs.map((run) => (
              <li key={run.id}>
                <RunPanel run={run} />
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
