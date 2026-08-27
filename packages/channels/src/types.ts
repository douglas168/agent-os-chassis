export type InboundMessage = {
  channel: string;
  direction: "in";
  from: string;
  to: string;
  subject?: string;
  body: string;
  providerMessageId: string;
  raw: unknown;
};

export type OutboundMessage = {
  to: string;
  subject?: string;
  body: string;
};

export type ProviderResult = { ok: boolean; providerMessageId?: string; error?: string };

export interface ChannelAdapter {
  verifyWebhook(req: Request): boolean;
  normalizeInbound(payload: unknown): InboundMessage;
  send(outbound: OutboundMessage): Promise<ProviderResult>;
}
