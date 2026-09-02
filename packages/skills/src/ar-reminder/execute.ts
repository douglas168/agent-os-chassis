import type { ChannelAdapter, ProviderResult } from "@agentos/channels";
import type { ArReminderDraft } from "./draft";

export async function execute(
  approvedDraft: ArReminderDraft,
  channel: Pick<ChannelAdapter, "send">,
  opts: { idempotencyKey: string },
): Promise<ProviderResult> {
  return channel.send({
    to: approvedDraft.to, subject: approvedDraft.subject, body: approvedDraft.body,
    idempotencyKey: opts.idempotencyKey,
  });
}
