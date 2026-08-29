import { z } from "zod";
import type { InboundMessage } from "@agentos/channels";
import type { EchoIntent } from "./understand";

export const EchoDraftSchema = z.object({
  kind: z.literal("reply"),
  to: z.string(),
  subject: z.string(),
  body: z.string(),
});
export type EchoDraft = z.infer<typeof EchoDraftSchema>;
// `to` is not editable — changing who a reply goes to is a bigger trust
// boundary than editing its content; `/approvals` (Plan 5) renders only these.
export const editableFields = ["subject", "body"] as const;

export async function draft(intent: EchoIntent, message: InboundMessage): Promise<EchoDraft> {
  return {
    kind: "reply", to: message.from,
    subject: `Re: ${message.subject ?? ""}`,
    body: `You said: ${intent.text}`,
  };
}
