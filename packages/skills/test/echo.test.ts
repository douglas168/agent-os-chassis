import { describe, it, expect } from "vitest";
import { echoSkill } from "../src/echo";
import type { InboundMessage } from "@agentos/channels";

const message: InboundMessage = {
  channel: "mock", direction: "in", from: "customer@example.com", to: "ops@example.com",
  subject: "Hi", body: "Hello there", providerMessageId: "p1", raw: {},
};

describe("echo skill", () => {
  it("triggers on mock channel messages", () => {
    expect(echoSkill.trigger.matches(message)).toBe(true);
  });

  it("does not trigger on other channels", () => {
    expect(echoSkill.trigger.matches({ ...message, channel: "email" })).toBe(false);
  });

  it("understand() extracts the inbound text as intent", async () => {
    const intent = await echoSkill.understand(message);
    expect(intent).toEqual({ text: "Hello there" });
  });

  it("draft() proposes an echo reply", async () => {
    const draft = await echoSkill.draft({ text: "Hello there" }, message);
    expect(draft).toEqual({
      kind: "reply", to: "customer@example.com",
      subject: "Re: Hi", body: "You said: Hello there",
    });
  });

  it("execute() sends the approved draft via the given channel", async () => {
    const sent: unknown[] = [];
    const channel = { send: async (o: unknown) => { sent.push(o); return { ok: true }; } };
    const result = await echoSkill.execute(
      { kind: "reply", to: "customer@example.com", subject: "Re: Hi", body: "You said: Hello there" },
      channel as any,
      { idempotencyKey: "test-action-id" },
    );
    expect(result.ok).toBe(true);
    expect(sent).toHaveLength(1);
  });

  it("execute() forwards the idempotency key onto the outbound message", async () => {
    const sent: unknown[] = [];
    const channel = { send: async (o: unknown) => { sent.push(o); return { ok: true }; } };
    await echoSkill.execute(
      { kind: "reply", to: "customer@example.com", subject: "Re: Hi", body: "You said: Hello there" },
      channel as any,
      { idempotencyKey: "action-abc-123" },
    );
    expect((sent[0] as any).idempotencyKey).toBe("action-abc-123");
  });
});
