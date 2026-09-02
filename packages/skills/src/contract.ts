import type { z } from "zod";
import type { InboundMessage, ProviderResult, ChannelAdapter } from "@agentos/channels";

export type SkillManifest = {
  id: string;
  name: string;
  description: string;
  approvalExpiryHours: number;
};

export type SkillTrigger =
  | { kind: "message"; matches: (message: InboundMessage) => boolean }
  | { kind: "cron"; intervalMs: number };

export type EntityStage = { key: string; label: string };
export type EntityField = { label: string; value: string };
export type EntityViewData = {
  id: string; skillId: string; title: string; subtitle?: string;
  fields: EntityField[]; stages: EntityStage[]; currentStage: string;
  runs: Record<string, unknown>[];
};
// table + stage list + a pure row -> display mapper — no I/O. The actual
// row loading lives in packages/core/src/engine/entity-view.ts (see this
// plan's Least-confident decision #3).
export type EntityView = {
  table: string;
  stages: EntityStage[];
  present: (row: Record<string, unknown>) => { title: string; subtitle?: string; fields: EntityField[]; currentStage: string };
};

export type Skill<Intent = unknown, Draft = unknown> = {
  manifest: SkillManifest;
  trigger: SkillTrigger;
  understand: (message: InboundMessage) => Promise<Intent>;
  draft: (intent: Intent, message: InboundMessage) => Promise<Draft>;
  execute: (approvedDraft: Draft, channel: Pick<ChannelAdapter, "send">, opts: { idempotencyKey: string }) => Promise<ProviderResult>;
  intentSchema: z.ZodType<Intent>;
  followups?: { offsets: number[]; cancelOnReply?: boolean };
  entity?: EntityView;
  // Spec § 4.2: re-validated against on every edit before it's allowed to execute.
  draftSchema: z.ZodType<Draft>;
  editableFields: readonly string[];
};
