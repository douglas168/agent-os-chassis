import { createMockChannel } from "@agentos/channels";
import { SKILLS } from "@agentos/skills";
import { db, resolveOrgContext, createMessagesRepo, createRunsRepo, createActionsRepo } from "@agentos/core";
import { getMastra } from "./mastra";

export async function matchAndRun(rawPayload: unknown): Promise<{ runId: string; actionId: string; matched: boolean }> {
  const ctx = await resolveOrgContext();
  const channel = createMockChannel();
  const inbound = channel.normalizeInbound(rawPayload);

  const messagesRepo = createMessagesRepo(db);
  const message = await messagesRepo.create(ctx, {
    channel: inbound.channel, direction: inbound.direction,
    providerMessageId: inbound.providerMessageId,
    from: inbound.from, to: inbound.to, subject: inbound.subject, body: inbound.body, raw: inbound.raw,
  });

  const skill = SKILLS.find((s) => s.trigger.matches(inbound));
  if (!skill) return { runId: "", actionId: "", matched: false };

  const mastra = getMastra();
  const workflowRun = await mastra.getWorkflow(`${skill.manifest.id}-workflow`).createRun();

  const runsRepo = createRunsRepo(db);
  const runRow = await runsRepo.create(ctx, {
    skillId: skill.manifest.id, messageId: message.id, mastraRunId: workflowRun.runId,
  });

  const intent = await skill.understand(inbound);
  const draft = await skill.draft(intent, inbound);
  const actionsRepo = createActionsRepo(db);
  const actionRow = await actionsRepo.create(ctx, {
    runId: runRow.id, skillId: skill.manifest.id, kind: (draft as any).kind ?? "reply",
    draft, idempotencyKey: `${runRow.id}:draft`,
  });

  const result = await workflowRun.start({ inputData: { message: inbound } });
  await runsRepo.updateStatus(ctx, runRow.id, result.status);

  return { runId: workflowRun.runId, actionId: actionRow.id, matched: true };
}
