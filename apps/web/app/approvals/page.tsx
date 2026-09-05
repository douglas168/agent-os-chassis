"use client";
import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

type Action = { id: string; runId: string; skillId: string; draft: any; status: string };

export default function ApprovalsPage() {
  const t = useTranslations("approvals");
  const [actions, setActions] = useState<Action[]>([]);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const res = await fetch("/api/actions");
    if (!res.ok) {
      setError(t("error"));
      return;
    }
    setActions(await res.json());
  }

  useEffect(() => { refresh(); }, []);

  async function decide(id: string, decision: "approved" | "denied") {
    setDecidingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/actions/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ decision }),
      });
      if (!res.ok) {
        const body: unknown = await res.json().catch(() => null);
        const message = body && typeof body === "object" && "error" in body && typeof body.error === "string"
          ? body.error
          : t("error");
        setError(message);
        return;
      }
      await refresh();
    } finally {
      setDecidingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
      {error && <p className="inline-block rounded-md bg-danger px-3 py-1.5 text-sm text-pill-foreground">{error}</p>}
      <ul className="space-y-3">
        {actions.length === 0 ? (
          <li className="text-sm text-muted-foreground">{t("empty")}</li>
        ) : (
          actions.map((a) => (
            <li key={a.id} className="rounded-lg border border-border bg-card p-4 shadow-card">
              <p className="text-sm text-foreground">
                <span className="font-medium">{a.skillId}</span>: {JSON.stringify(a.draft)}
              </p>
              <div className="mt-3 flex gap-2">
                <button
                  onClick={() => decide(a.id, "approved")}
                  disabled={decidingId === a.id}
                  className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  {t("approve")}
                </button>
                <button
                  onClick={() => decide(a.id, "denied")}
                  disabled={decidingId === a.id}
                  className={cn("rounded-md px-3 py-1.5 text-sm disabled:opacity-50", "bg-danger text-pill-foreground hover:opacity-90")}
                >
                  {t("deny")}
                </button>
              </div>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
