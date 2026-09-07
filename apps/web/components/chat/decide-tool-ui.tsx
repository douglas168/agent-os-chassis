"use client";

import { useState } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import { useTranslations } from "next-intl";
import { ApprovalCard, type ActionWithMeta } from "@/components/approval-card";

type PresentPendingActionArgs = { actionId: string };
type PresentPendingActionResult = {
  found: boolean;
  action: ActionWithMeta | null;
};

export const DecideToolUI = makeAssistantToolUI<
  PresentPendingActionArgs,
  PresentPendingActionResult
>({
  toolName: "presentPendingAction",
  display: "standalone",
  render: ({ status, result }) => {
    const t = useTranslations("chat");
    const [deciding, setDeciding] = useState(false);

    if (status.type !== "complete") {
      return <p className="text-xs text-muted-foreground">{t("loadingAction")}</p>;
    }
    if (!result?.found || !result.action) {
      return <p className="text-xs text-muted-foreground">{t("actionNotPending")}</p>;
    }

    async function decide(id: string, decision: "approved" | "denied") {
      setDeciding(true);
      try {
        await fetch(`/api/actions/${id}`, {
          method: "PATCH",
          body: JSON.stringify({ decision }),
        });
      } finally {
        setDeciding(false);
      }
    }

    async function edit(id: string, draft: Record<string, unknown>) {
      await fetch(`/api/actions/${id}/edit`, {
        method: "POST",
        body: JSON.stringify({ draft }),
      });
    }

    return (
      <ul>
        <ApprovalCard
          action={result.action}
          onDecide={decide}
          onEdit={edit}
          deciding={deciding}
        />
      </ul>
    );
  },
});
