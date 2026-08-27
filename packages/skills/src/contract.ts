import type { InboundMessage, OutboundMessage, ProviderResult, ChannelAdapter } from "@agentos/channels";

export type SkillManifest = {
  id: string;
  name: string;
  description: string;
  approvalExpiryHours: number;
};

export type SkillTrigger = { matches: (message: InboundMessage) => boolean };

export type Skill<Intent = unknown, Draft = unknown> = {
  manifest: SkillManifest;
  trigger: SkillTrigger;
  understand: (message: InboundMessage) => Promise<Intent>;
  draft: (intent: Intent, message: InboundMessage) => Promise<Draft>;
  execute: (approvedDraft: Draft, channel: Pick<ChannelAdapter, "send">) => Promise<ProviderResult>;
};
