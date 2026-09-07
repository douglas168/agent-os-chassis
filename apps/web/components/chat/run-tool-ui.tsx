"use client";

import { useEffect, useState } from "react";
import { makeAssistantToolUI } from "@assistant-ui/react";
import type { RunPanelData } from "@agentos/core";
import { RunPanel } from "@/components/run-panel";
import { useTranslations } from "next-intl";

type RunSkillArgs = { skillId: string; message: string };
type RunSkillResult = {
  ok: boolean;
  runId?: string;
  actionId?: string;
  error?: string;
};

export const RunToolUI = makeAssistantToolUI<RunSkillArgs, RunSkillResult>({
  toolName: "runSkill",
  display: "standalone",
  render: ({ status, result }) => {
    const t = useTranslations("chat");
    const [run, setRun] = useState<RunPanelData | null>(null);

    useEffect(() => {
      if (status.type !== "complete" || !result?.ok || !result.runId) return;
      fetch(`/api/runs/${result.runId}`)
        .then((response) => (response.ok ? response.json() : null))
        .then((data) => setRun(data));
    }, [status.type, result?.ok, result?.runId]);

    if (status.type !== "complete") {
      return <p className="text-xs text-muted-foreground">{t("runningSkill")}</p>;
    }
    if (!result?.ok) {
      return <p className="text-xs text-danger">{result?.error ?? t("runFailed")}</p>;
    }
    if (!run) {
      return <p className="text-xs text-muted-foreground">{t("loadingRun")}</p>;
    }
    return <RunPanel run={run} />;
  },
});
