import type { ChannelAdapter, InboundMessage, OutboundMessage, ProviderResult } from "./types";

export function createLineChannel(): ChannelAdapter {
  return {
    verifyWebhook(): boolean {
      return false;
    },
    normalizeInbound(payload: unknown): InboundMessage {
      const p = payload as Record<string, string>;
      return {
        channel: "line", direction: "in",
        from: p.from, to: p.to, subject: undefined, body: p.body,
        providerMessageId: p.providerMessageId, raw: payload,
      };
    },
    async send(_outbound: OutboundMessage): Promise<ProviderResult> {
      if (!process.env.LINE_CHANNEL_ACCESS_TOKEN) {
        throw new Error("LINE_CHANNEL_ACCESS_TOKEN is not set — see .env.example");
      }
      throw new Error("LINE channel send() has no real provider wired — this is a documented stub, see FORKING.md");
    },
  };
}
