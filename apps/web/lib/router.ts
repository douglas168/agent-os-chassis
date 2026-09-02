import { createMockChannel } from "@agentos/channels";
import { SKILLS } from "@agentos/skills";
import { db, createMessagesRepo, createContactsRepo, createFollowUpsRepo } from "@agentos/core";
import { resolveChannelOrgContext } from "./context";
import { runSkillForMessage } from "@agentos/core";

export async function matchAndRun(rawPayload: unknown): Promise<{ runId: string; actionId: string; matched: boolean }> {
  const ctx = await resolveChannelOrgContext();
  const channel = createMockChannel();
  const inbound = channel.normalizeInbound(rawPayload);

  const contactsRepo = createContactsRepo(db);
  const contact = await contactsRepo.findByEmail(ctx, inbound.from);

  const messagesRepo = createMessagesRepo(db);
  const message = await messagesRepo.create(ctx, {
    channel: inbound.channel, direction: inbound.direction,
    providerMessageId: inbound.providerMessageId,
    from: inbound.from, to: inbound.to, subject: inbound.subject, body: inbound.body, raw: inbound.raw,
    contactId: contact?.id ?? null,
  });

  if (contact) {
    const followUpsRepo = createFollowUpsRepo(db);
    const optedOut = SKILLS.filter((s) => s.followups?.cancelOnReply === false).map((s) => s.manifest.id);
    await followUpsRepo.cancelScheduledForContact(ctx, contact.id, "cancel_on_reply", optedOut);
  }

  const skill = SKILLS.find((s) => s.trigger.kind === "message" && s.trigger.matches(inbound));
  if (!skill) return { runId: "", actionId: "", matched: false };

  const { runId, actionId } = await runSkillForMessage(ctx, skill, inbound, message.id);
  return { runId, actionId, matched: true };
}
