import { and, desc, eq } from "drizzle-orm";
import { db } from "../db/client";
import { actions, messages } from "../db/schema";
import { createRunsRepo } from "../repositories/runs";
import type { OrgContext } from "../context";

export type RunPanelStats = {
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
  stats: RunPanelStats | null;
};

export async function toRunPanelData(
  ctx: OrgContext,
  runId: string,
): Promise<RunPanelData | null> {
  const run = await createRunsRepo(db).findById(ctx, runId);
  if (!run) return null;

  const sourceMessage = run.messageId
    ? (await db.select().from(messages).where(and(
      eq(messages.orgId, ctx.orgId),
      eq(messages.id, run.messageId),
    )))[0]
    : undefined;
  const [action] = await db.select().from(actions).where(and(
    eq(actions.orgId, ctx.orgId),
    eq(actions.runId, run.id),
  )).orderBy(desc(actions.createdAt));

  const conversation: RunPanelData["conversation"] = [];
  if (sourceMessage) conversation.push({ role: "inbound", text: sourceMessage.body });
  if (action) conversation.push({ role: "draft", text: JSON.stringify(action.draft) });

  const trace: RunPanelData["trace"] = [];
  if (run.intent) trace.push({ label: "understand", detail: run.intent });
  if (run.error) {
    trace.push({
      label: "error",
      detail: {
        error: run.error,
        failedStep: run.failedStep,
        failedInput: run.failedInput,
      },
    });
  }

  return {
    id: run.id,
    skillId: run.skillId,
    status: run.status,
    createdAt: run.createdAt.toISOString(),
    conversation,
    trace,
    stats: (run.stats as RunPanelStats | null) ?? null,
  };
}
