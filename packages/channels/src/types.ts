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
  // finding 15 (sustained): the execute-boundary idempotency key from
  // spec § 4 step 6, threaded down to whichever real channel adapter a
  // later plan adds. The mock adapter (packages/channels/src/mock.ts)
  // requires no change — it already stores whatever object it is given.
  idempotencyKey?: string;
};

export type ProviderResult = { ok: boolean; providerMessageId?: string; error?: string };

export interface ChannelAdapter {
  verifyWebhook(req: Request): boolean;
  normalizeInbound(payload: unknown): InboundMessage;
  send(outbound: OutboundMessage): Promise<ProviderResult>;
}
