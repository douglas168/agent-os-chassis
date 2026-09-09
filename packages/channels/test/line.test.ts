import { describe, it, expect } from "vitest";
import { createLineChannel } from "../src/line";

describe("LINE channel stub", () => {
  it("normalizes an inbound payload into InboundMessage shape", () => {
    const channel = createLineChannel();
    const inbound = channel.normalizeInbound({
      from: "U1234", to: "ops-line", body: "hi", providerMessageId: "m1",
    });
    expect(inbound).toEqual({
      channel: "line", direction: "in",
      from: "U1234", to: "ops-line", subject: undefined, body: "hi",
      providerMessageId: "m1", raw: expect.any(Object),
    });
  });

  it("throws a clear, named error on send() when LINE_CHANNEL_ACCESS_TOKEN is not configured", async () => {
    const channel = createLineChannel();
    await expect(channel.send({ to: "U1234", body: "reply" }))
      .rejects.toThrow("LINE_CHANNEL_ACCESS_TOKEN is not set — see .env.example");
  });

  it("verifyWebhook returns false — no real provider signature to check yet", () => {
    const channel = createLineChannel();
    expect(channel.verifyWebhook(new Request("http://localhost"))).toBe(false);
  });
});
