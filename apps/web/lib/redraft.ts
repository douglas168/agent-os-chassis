import { db, createActionsRepo, createRunsRepo, createMessagesRepo, can, type OrgContext } from "@agentos/core";
import { SKILLS } from "@agentos/skills";
import { runSkillForMessage } from "@agentos/core";

export async function redraftAction(ctx: OrgContext, actionId: string): Promise<{ runId: string; actionId: string }> {
  if (!can(ctx.role, { action: ["approve"] })) {
    throw new Error(`role '${ctx.role}' cannot redraft actions`);
  }

  const actionsRepo = createActionsRepo(db);
  const runsRepo = createRunsRepo(db);
  const messagesRepo = createMessagesRepo(db);

  const action = await actionsRepo.findById(ctx, actionId);
  if (!action) throw new Error(`no action for id=${actionId}`);
  if (action.status !== "expired") throw new Error(`action ${actionId} is not expired, cannot be redrafted`);

  const run = await runsRepo.findById(ctx, action.runId);
  if (!run || !run.messageId) throw new Error(`no originating message for action ${actionId}`);

  const messages = await messagesRepo.listForOrg(ctx);
  const message = messages.find((m) => m.id === run.messageId);
  if (!message) throw new Error(`no message for id=${run.messageId}`);

  const skill = SKILLS.find((s) => s.manifest.id === action.skillId);
  if (!skill) throw new Error(`no skill registered for id=${action.skillId}`);

  const inbound = {
    channel: message.channel, direction: "in" as const, from: message.from, to: message.to,
    subject: message.subject ?? undefined, body: message.body, providerMessageId: message.providerMessageId,
    raw: message.raw,
  };

  return runSkillForMessage(ctx, skill, inbound, message.id);
}
