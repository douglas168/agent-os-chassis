import { z } from "zod";
import type { InboundMessage } from "@agentos/channels";

export const ArReminderIntentSchema = z.object({ invoiceId: z.string(), summary: z.string() });
export type ArReminderIntent = z.infer<typeof ArReminderIntentSchema>;

export async function understand(message: InboundMessage): Promise<ArReminderIntent> {
  const invoiceId = (message.raw as { invoiceId?: string })?.invoiceId ?? "";
  return { invoiceId, summary: message.body };
}
