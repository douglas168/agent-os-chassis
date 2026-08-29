import type { z } from "zod";
import type { InboundMessage, ProviderResult, ChannelAdapter } from "@agentos/channels";

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
  execute: (approvedDraft: Draft, channel: Pick<ChannelAdapter, "send">, opts: { idempotencyKey: string }) => Promise<ProviderResult>;
  // Spec § 4.2: re-validated against on every edit before it's allowed to execute.
  draftSchema: z.ZodType<Draft>;
  editableFields: readonly string[];
};
