import { z } from "zod";
import type { InboundMessage } from "@agentos/channels";

export const EchoIntentSchema = z.object({ text: z.string() });
export type EchoIntent = z.infer<typeof EchoIntentSchema>;

export async function understand(message: InboundMessage): Promise<EchoIntent> {
  return { text: message.body };
}
