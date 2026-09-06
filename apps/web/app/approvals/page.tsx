"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { ApprovalCard, type ActionWithMeta } from "@/components/approval-card";
import { cn } from "@/lib/cn";

type ExpiredAction = {
  id: string;
  skillId: string;
  draft: Record<string, unknown>;
  editedDraft: Record<string, unknown> | null;
};

function ExpiredActionCard({
  action,
  onRedraft,
  redrafting,
}: {
  action: ExpiredAction;
  onRedraft: (id: string) => void;
  redrafting: boolean;
}) {
  const t = useTranslations("approvals");
  const current = action.editedDraft ?? action.draft;

  return (
    <li className="rounded-lg border border-border bg-card p-4 shadow-card">
      <p className="text-sm font-medium text-foreground">{action.skillId}</p>
      <div className="mt-2 space-y-1">
        {Object.entries(current).map(([field, value]) => (
          <p key={field} className="text-xs text-muted-foreground">
            <span className="font-medium">{field}:</span> {String(value)}
          </p>
        ))}
      </div>
      <button
        onClick={() => onRedraft(action.id)}
        disabled={redrafting}
        className="mt-3 rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent disabled:opacity-50"
      >
        {t("redraft")}
      </button>
    </li>
  );
}

export default function ApprovalsPage() {
  const t = useTranslations("approvals");
  const [tab, setTab] = useState<"pending" | "expired">("pending");
  const [actions, setActions] = useState<ActionWithMeta[]>([]);
  const [expiredActions, setExpiredActions] = useState<ExpiredAction[]>([]);
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [redraftingId, setRedraftingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function refresh() {
    const [pendingRes, expiredRes] = await Promise.all([
      fetch("/api/actions?status=pending"),
      fetch("/api/actions?status=expired"),
    ]);
    if (!pendingRes.ok || !expiredRes.ok) {
      setError(t("error"));
      return;
    }
    setActions(await pendingRes.json());
    setExpiredActions(await expiredRes.json());
  }

  useEffect(() => {
    refresh();
  }, []);

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

  async function edit(id: string, draft: Record<string, unknown>) {
    setError(null);
    const res = await fetch(`/api/actions/${id}/edit`, {
      method: "POST",
      body: JSON.stringify({ draft }),
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
  }

  async function redraft(id: string) {
    setRedraftingId(id);
    setError(null);
    try {
      const res = await fetch(`/api/actions/${id}/redraft`, { method: "POST" });
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
      setRedraftingId(null);
    }
  }

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold text-foreground">{t("title")}</h1>
      <div className="flex gap-2">
        <button
          onClick={() => setTab("pending")}
          aria-current={tab === "pending" ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm",
            tab === "pending" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent",
          )}
        >
          {t("tabPending")}
        </button>
        <button
          onClick={() => setTab("expired")}
          aria-current={tab === "expired" ? "page" : undefined}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm",
            tab === "expired" ? "bg-primary text-primary-foreground" : "text-foreground hover:bg-accent",
          )}
        >
          {t("tabExpired")} {expiredActions.length > 0 && `(${expiredActions.length})`}
        </button>
      </div>

      {error && <p className="inline-block rounded-md bg-danger px-3 py-1.5 text-sm text-pill-foreground">{error}</p>}

      {tab === "pending" ? (
        <ul className="space-y-3">
          {actions.length === 0 ? (
            <li className="text-sm text-muted-foreground">{t("empty")}</li>
          ) : (
            actions.map((action) => (
              <ApprovalCard
                key={action.id}
                action={action}
                onDecide={decide}
                onEdit={edit}
                deciding={decidingId === action.id}
              />
            ))
          )}
        </ul>
      ) : (
        <ul className="space-y-3">
          {expiredActions.length === 0 ? (
            <li className="text-sm text-muted-foreground">{t("expiredEmpty")}</li>
          ) : (
            expiredActions.map((action) => (
              <ExpiredActionCard
                key={action.id}
                action={action}
                onRedraft={redraft}
                redrafting={redraftingId === action.id}
              />
            ))
          )}
        </ul>
      )}
    </div>
  );
}
