import { describe, it, expect } from "vitest";
import { createMockChannel } from "../src/mock";

describe("mock channel adapter", () => {
  it("normalizes an inbound payload into InboundMessage shape", () => {
    const channel = createMockChannel();
    const inbound = channel.normalizeInbound({
      from: "customer@example.com", to: "ops@example.com",
      subject: "Question", body: "hi", providerMessageId: "p1",
    });
    expect(inbound).toEqual({
      channel: "mock", direction: "in",
      from: "customer@example.com", to: "ops@example.com",
      subject: "Question", body: "hi", providerMessageId: "p1",
      raw: expect.any(Object),
    });
  });

  it("records every send() call for test assertions", async () => {
    const channel = createMockChannel();
    const result = await channel.send({
      to: "customer@example.com", subject: "Re: Question", body: "reply",
    });
    expect(result.ok).toBe(true);
    expect(channel.sentMessages).toHaveLength(1);
    expect(channel.sentMessages[0].body).toBe("reply");
  });
});
