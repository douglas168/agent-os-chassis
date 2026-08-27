import type { ChannelAdapter, InboundMessage, OutboundMessage, ProviderResult } from "./types";

export function createMockChannel(): ChannelAdapter & { sentMessages: OutboundMessage[] } {
  const sentMessages: OutboundMessage[] = [];
  return {
    sentMessages,
    verifyWebhook: () => true,
    normalizeInbound(payload: unknown): InboundMessage {
      const p = payload as Record<string, string>;
      return {
        channel: "mock", direction: "in",
        from: p.from, to: p.to, subject: p.subject, body: p.body,
        providerMessageId: p.providerMessageId, raw: payload,
      };
    },
    async send(outbound: OutboundMessage): Promise<ProviderResult> {
      sentMessages.push(outbound);
      return { ok: true, providerMessageId: `mock-${sentMessages.length}` };
    },
  };
}
