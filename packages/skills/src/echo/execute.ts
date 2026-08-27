import type { ChannelAdapter, ProviderResult } from "@agentos/channels";
import type { EchoDraft } from "./draft";

export async function execute(approvedDraft: EchoDraft, channel: Pick<ChannelAdapter, "send">): Promise<ProviderResult> {
  return channel.send({ to: approvedDraft.to, subject: approvedDraft.subject, body: approvedDraft.body });
}
