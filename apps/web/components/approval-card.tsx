"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export type ActionWithMeta = {
  id: string;
  runId: string;
  skillId: string;
  draft: Record<string, unknown>;
  editedDraft: Record<string, unknown> | null;
  status: string;
  expiresAt: string;
  editableFields: string[];
};

function formatCountdown(
  expiresAt: string,
  t: (key: "expired" | "expiresIn", values?: { hours: number; minutes: number }) => string,
): string {
  const msLeft = new Date(expiresAt).getTime() - Date.now();
  if (msLeft <= 0) return t("expired");
  const hours = Math.floor(msLeft / 3_600_000);
  const minutes = Math.floor((msLeft % 3_600_000) / 60_000);
  return t("expiresIn", { hours, minutes });
}

export function ApprovalCard({
  action,
  onDecide,
  onEdit,
  deciding,
}: {
  action: ActionWithMeta;
  onDecide: (id: string, decision: "approved" | "denied") => void | Promise<void>;
  onEdit: (id: string, draft: Record<string, unknown>) => void | Promise<void>;
  deciding: boolean;
}) {
  const t = useTranslations("approvals");
  const current = action.editedDraft ?? action.draft;
  const [values, setValues] = useState<Record<string, string>>(
    Object.fromEntries(
      action.editableFields.map((field) => [field, String(current[field] ?? "")]),
    ),
  );
  const readOnlyFields = Object.keys(current).filter((field) => !action.editableFields.includes(field));
  const isDirty = action.editableFields.some(
    (field) => String(current[field] ?? "") !== values[field],
  );

  async function decideWithPendingEdits(decision: "approved" | "denied") {
    if (isDirty) {
      await onEdit(action.id, { ...current, ...values });
    }
    await onDecide(action.id, decision);
  }

  return (
    <li className="rounded-lg border border-border bg-card p-4 shadow-card">
      <p className="text-sm font-medium text-foreground">{action.skillId}</p>
      <p className="mt-1 text-xs text-muted-foreground">
        {formatCountdown(action.expiresAt, t)}
      </p>

      {readOnlyFields.length > 0 && (
        <div className="mt-3 space-y-1 rounded-md bg-muted p-2">
          {readOnlyFields.map((field) => (
            <p key={field} className="text-xs text-muted-foreground">
              <span className="font-medium">{field}:</span> {String(current[field] ?? "")}
            </p>
          ))}
        </div>
      )}

      <div className="mt-3 space-y-2">
        {action.editableFields.map((field) => (
          <div key={field}>
            <label htmlFor={`${action.id}-${field}`} className="text-xs text-muted-foreground">
              {field}
            </label>
            <textarea
              id={`${action.id}-${field}`}
              aria-label={field}
              value={values[field] ?? ""}
              onChange={(event) => setValues((currentValues) => ({
                ...currentValues,
                [field]: event.target.value,
              }))}
              className="mt-1 w-full rounded-md border border-border bg-transparent p-2 text-sm text-foreground"
            />
          </div>
        ))}
      </div>

      <div className="mt-3 flex gap-2">
        <button
          onClick={() => onEdit(action.id, { ...current, ...values })}
          className="rounded-md border border-border px-3 py-1.5 text-sm text-foreground hover:bg-accent"
        >
          {t("save")}
        </button>
        <button
          onClick={() => decideWithPendingEdits("approved")}
          disabled={deciding}
          className="rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground hover:opacity-90 disabled:opacity-50"
        >
          {t("approve")}
        </button>
        <button
          onClick={() => decideWithPendingEdits("denied")}
          disabled={deciding}
          className={cn(
            "rounded-md px-3 py-1.5 text-sm disabled:opacity-50",
            "bg-danger text-pill-foreground hover:opacity-90",
          )}
        >
          {t("deny")}
        </button>
      </div>
    </li>
  );
}
