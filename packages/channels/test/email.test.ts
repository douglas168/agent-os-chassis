import { describe, it, expect } from "vitest";
import { createEmailChannel } from "../src/email";

describe("email channel stub", () => {
  it("normalizes an inbound payload into InboundMessage shape", () => {
    const channel = createEmailChannel();
    const inbound = channel.normalizeInbound({
      from: "customer@example.com", to: "ops@example.com",
      subject: "Question", body: "hi", providerMessageId: "p1",
    });
    expect(inbound).toEqual({
      channel: "email", direction: "in",
      from: "customer@example.com", to: "ops@example.com",
      subject: "Question", body: "hi", providerMessageId: "p1",
      raw: expect.any(Object),
    });
  });

  it("throws a clear, named error on send() when EMAIL_API_KEY is not configured", async () => {
    const channel = createEmailChannel();
    await expect(channel.send({ to: "customer@example.com", body: "reply" }))
      .rejects.toThrow("EMAIL_API_KEY is not set — see .env.example");
  });

  it("verifyWebhook returns false — no real provider signature to check yet", () => {
    const channel = createEmailChannel();
    expect(channel.verifyWebhook(new Request("http://localhost"))).toBe(false);
  });
});
