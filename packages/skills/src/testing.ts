import { createMockChannel } from "@agentos/channels";
import type { InboundMessage } from "@agentos/channels";
import type { Skill } from "./contract";

export function fixtureMessage(overrides: Partial<InboundMessage> = {}): InboundMessage {
  return {
    channel: "mock", direction: "in", from: "customer@example.com", to: "ops@example.com",
    subject: "Hi", body: "Hello there", providerMessageId: `p-${crypto.randomUUID()}`, raw: {},
    ...overrides,
  };
}

export async function runSkillLoop<Intent, Draft>(skill: Skill<Intent, Draft>, message: InboundMessage) {
  const intent = await skill.understand(message);
  const draft = await skill.draft(intent, message);
  const channel = createMockChannel();
  const result = await skill.execute(draft, channel, { idempotencyKey: `test-${crypto.randomUUID()}` });
  return { intent, draft, result, sentMessages: channel.sentMessages };
}
