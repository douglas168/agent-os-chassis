import type { InboundMessage } from "@agentos/channels";
import type { EchoIntent } from "./understand";

export type EchoDraft = { kind: "reply"; to: string; subject: string; body: string };

export async function draft(intent: EchoIntent, message: InboundMessage): Promise<EchoDraft> {
  return {
    kind: "reply", to: message.from,
    subject: `Re: ${message.subject ?? ""}`,
    body: `You said: ${intent.text}`,
  };
}
