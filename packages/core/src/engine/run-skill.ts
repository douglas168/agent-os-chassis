import { db } from "../db/client";
import { createActionsRepo } from "../repositories/actions";
import { createRunsRepo } from "../repositories/runs";
import type { OrgContext } from "../context";
import type { Skill } from "@agentos/skills";
import type { InboundMessage } from "@agentos/channels";
import { getMastra } from "./mastra";

export async function runSkillForMessage(
  ctx: OrgContext,
  skill: Skill<any, any>,
  inbound: InboundMessage,
  messageId: string,
  entityRef: { table: string; id: string } | null = null,
): Promise<{ runId: string; actionId: string }> {
  const startedAt = Date.now();
  const mastra = getMastra();
  const workflowRun = await mastra.getWorkflow(`${skill.manifest.id}-workflow`).createRun();

  const runsRepo = createRunsRepo(db);
  const runRow = await runsRepo.create(ctx, {
    skillId: skill.manifest.id, messageId, mastraRunId: workflowRun.runId, entityRef,
  });

  const intent = await skill.understand(inbound);
  const draft = await skill.draft(intent, inbound);
  const actionsRepo = createActionsRepo(db);
  const expiresAt = new Date(Date.now() + skill.manifest.approvalExpiryHours * 60 * 60 * 1000);
  const actionRow = await actionsRepo.create(ctx, {
    runId: runRow.id, skillId: skill.manifest.id, kind: (draft as any).kind ?? "reply",
    draft, idempotencyKey: `${runRow.id}:draft`, expiresAt,
  });

  // LCD4 (ingest half): thread the values already computed above into the
  // workflow's own understand/draft steps instead of letting them recompute.
  // Keep the workflow boundary tolerant of callers that provide the minimal
  // message shape used by the engine tests. Normal channel callers already
  // provide these fields; the fallback values preserve the persisted message
  // id as the provider identity when it is absent.
  const workflowMessage = {
    ...inbound,
    direction: inbound.direction ?? "in",
    providerMessageId: inbound.providerMessageId ?? messageId,
    raw: inbound.raw ?? {},
  };
  const result = await workflowRun.start({ inputData: { message: workflowMessage, intent, draft } });
  const wallClockMs = Date.now() - startedAt;

  // Understand/draft are deterministic in the v1 skills and no LLM usage
  // instrumentation exists yet. Keep those fields null instead of inventing
  // measurements; steps and wall-clock time are the real values available
  // from this workflow run.
  await runsRepo.updateStatus(ctx, runRow.id, result.status, {
    intent,
    stats: {
      turns: null,
      steps: Object.keys(result.steps ?? {}).length,
      wallClockMs,
      tokensIn: null,
      tokensOut: null,
      ttftMs: null,
      cacheHitRate: null,
    },
  });

  return { runId: workflowRun.runId, actionId: actionRow.id };
}
