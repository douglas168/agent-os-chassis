import { db, createActionsRepo, createRunsRepo, type OrgContext } from "@agentos/core";
import type { Skill } from "@agentos/skills";
import type { InboundMessage } from "@agentos/channels";
import { getMastra } from "./mastra";

export async function runSkillForMessage(
  ctx: OrgContext,
  skill: Skill<any, any>,
  inbound: InboundMessage,
  messageId: string,
): Promise<{ runId: string; actionId: string }> {
  const mastra = getMastra();
  const workflowRun = await mastra.getWorkflow(`${skill.manifest.id}-workflow`).createRun();

  const runsRepo = createRunsRepo(db);
  const runRow = await runsRepo.create(ctx, {
    skillId: skill.manifest.id, messageId, mastraRunId: workflowRun.runId,
  });

  const intent = await skill.understand(inbound);
  const draft = await skill.draft(intent, inbound);
  const actionsRepo = createActionsRepo(db);
  const expiresAt = new Date(Date.now() + skill.manifest.approvalExpiryHours * 60 * 60 * 1000);
  const actionRow = await actionsRepo.create(ctx, {
    runId: runRow.id, skillId: skill.manifest.id, kind: (draft as any).kind ?? "reply",
    draft, idempotencyKey: `${runRow.id}:draft`, expiresAt,
  });

  const result = await workflowRun.start({ inputData: { message: inbound } });
  await runsRepo.updateStatus(ctx, runRow.id, result.status);

  return { runId: workflowRun.runId, actionId: actionRow.id };
}
