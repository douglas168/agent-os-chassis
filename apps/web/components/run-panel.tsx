"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { cn } from "@/lib/cn";

export type RunStats = {
  turns: number | null;
  steps: number;
  wallClockMs: number;
  tokensIn: number | null;
  tokensOut: number | null;
  ttftMs: number | null;
  cacheHitRate: number | null;
};

export type RunPanelData = {
  id: string;
  skillId: string;
  status: string;
  createdAt: string;
  conversation: { role: "inbound" | "draft"; text: string }[];
  trace: { label: string; detail: unknown }[];
  stats: RunStats | null;
};

export function RunPanel({ run }: { run: RunPanelData }) {
  const t = useTranslations("runPanel");
  const [tab, setTab] = useState<"conversation" | "trace">("conversation");

  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-card">
      <div className="mb-2 flex items-center justify-between">
        <p className="text-xs text-muted-foreground">{run.skillId} — {run.status} — {run.createdAt}</p>
        <div role="tablist" className="flex gap-1 text-xs">
          <button
            role="tab"
            aria-selected={tab === "conversation"}
            onClick={() => setTab("conversation")}
            className={cn(
              "rounded-md px-2 py-1",
              tab === "conversation" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {t("conversation")}
          </button>
          <button
            role="tab"
            aria-selected={tab === "trace"}
            onClick={() => setTab("trace")}
            className={cn(
              "rounded-md px-2 py-1",
              tab === "trace" ? "bg-primary text-primary-foreground" : "text-muted-foreground",
            )}
          >
            {t("trace")}
          </button>
        </div>
      </div>

      {tab === "conversation" ? (
        <ul className="space-y-1 text-sm text-foreground">
          {run.conversation.length === 0 ? (
            <li className="text-muted-foreground">{t("noConversation")}</li>
          ) : (
            run.conversation.map((turn, index) => (
              <li key={index}>
                <span className="text-muted-foreground">{turn.role}:</span> {turn.text}
              </li>
            ))
          )}
        </ul>
      ) : (
        <ul className="space-y-1 text-sm text-foreground">
          {run.trace.length === 0 ? (
            <li className="text-muted-foreground">{t("noTrace")}</li>
          ) : (
            run.trace.map((row, index) => (
              <li key={index}>
                <span className="font-mono text-xs text-primary">{row.label}</span>{" "}
                <span className="text-xs text-muted-foreground">{JSON.stringify(row.detail)}</span>
              </li>
            ))
          )}
        </ul>
      )}

      {run.stats && (
        <dl className="mt-3 grid grid-cols-3 gap-2 border-t border-border pt-2 text-xs text-muted-foreground xl:grid-cols-7">
          <div><dt>{t("turns")}</dt><dd className="text-foreground">{run.stats.turns ?? "—"}</dd></div>
          <div><dt>{t("steps")}</dt><dd className="text-foreground">{run.stats.steps}</dd></div>
          <div><dt>{t("wallClock")}</dt><dd className="text-foreground">{run.stats.wallClockMs}ms</dd></div>
          <div><dt>{t("tokensIn")}</dt><dd className="text-foreground">{run.stats.tokensIn ?? "—"}</dd></div>
          <div><dt>{t("tokensOut")}</dt><dd className="text-foreground">{run.stats.tokensOut ?? "—"}</dd></div>
          <div><dt>{t("ttft")}</dt><dd className="text-foreground">{run.stats.ttftMs ?? "—"}</dd></div>
          <div><dt>{t("cacheHitRate")}</dt><dd className="text-foreground">{run.stats.cacheHitRate ?? "—"}</dd></div>
        </dl>
      )}
    </div>
  );
}
