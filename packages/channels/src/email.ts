import type { ChannelAdapter, InboundMessage, OutboundMessage, ProviderResult } from "./types";

// Documented stub (master spec § 12 non-goal: "production email/LINE
// credentials"). Implements the real ChannelAdapter contract so a fork can
// wire a real provider behind this file without touching any caller —
// send() throws rather than silently no-op-ing, so an unconfigured stub
// fails loud instead of looking like mail is being sent.
export function createEmailChannel(): ChannelAdapter {
  return {
    verifyWebhook(): boolean {
      return false;
    },
    normalizeInbound(payload: unknown): InboundMessage {
      const p = payload as Record<string, string>;
      return {
        channel: "email", direction: "in",
        from: p.from, to: p.to, subject: p.subject, body: p.body,
        providerMessageId: p.providerMessageId, raw: payload,
      };
    },
    async send(_outbound: OutboundMessage): Promise<ProviderResult> {
      if (!process.env.EMAIL_API_KEY) {
        throw new Error("EMAIL_API_KEY is not set — see .env.example");
      }
      throw new Error("email channel send() has no real provider wired — this is a documented stub, see FORKING.md");
    },
  };
}
