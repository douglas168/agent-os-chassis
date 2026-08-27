import type { InboundMessage } from "@agentos/channels";

export type EchoIntent = { text: string };

export async function understand(message: InboundMessage): Promise<EchoIntent> {
  return { text: message.body };
}
