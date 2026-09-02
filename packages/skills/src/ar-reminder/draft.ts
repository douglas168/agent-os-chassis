import { z } from "zod";
import type { InboundMessage } from "@agentos/channels";
import type { ArReminderIntent } from "./understand";

export const ArReminderDraftSchema = z.object({
  kind: z.literal("reminder"), to: z.string(), subject: z.string(), body: z.string(), invoiceId: z.string(),
});
export type ArReminderDraft = z.infer<typeof ArReminderDraftSchema>;
export const editableFields = ["subject", "body"] as const;

export async function draft(intent: ArReminderIntent, message: InboundMessage): Promise<ArReminderDraft> {
  return {
    kind: "reminder", to: message.from,
    subject: `Friendly reminder: ${message.subject ?? "your invoice"}`,
    body: `Hi! ${intent.summary}\n\nJust a friendly reminder — let us know if you have any questions.`,
    invoiceId: intent.invoiceId,
  };
}
