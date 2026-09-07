import { z } from "zod";
import type { InboundMessage, ProviderResult, ChannelAdapter } from "@agentos/channels";

export type SkillManifest = {
  id: string;
  name: string;
  description: string;
  approvalExpiryHours: number;
  configSchema?: z.ZodType<unknown>;
};

export type ConfigFieldDescriptor = {
  name: string;
  type: "string" | "number" | "boolean";
  optional: boolean;
};

export function describeConfigFields(schema: z.ZodType<unknown>): ConfigFieldDescriptor[] {
  if (!(schema instanceof z.ZodObject)) return [];

  return Object.entries(schema.shape).map(([name, fieldSchema]) => {
    let inner = fieldSchema as z.ZodTypeAny;
    let optional = false;

    while (inner instanceof z.ZodOptional || inner instanceof z.ZodDefault) {
      if (inner instanceof z.ZodOptional) optional = true;
      inner = inner._def.innerType;
    }

    const type = inner instanceof z.ZodNumber
      ? "number"
      : inner instanceof z.ZodBoolean
        ? "boolean"
        : "string";
    return { name, type, optional };
  });
}

export type SkillTrigger =
  | { kind: "message"; matches: (message: InboundMessage) => boolean }
  | { kind: "cron"; intervalMs: number };

export type EntityStage = { key: string; label: string };
export type EntityField = { label: string; value: string };
export type EntityContact = { id: string; name: string; company: string | null } | null;
export type EntityDocument = { id: string; title: string; mime: string; sizeBytes: number };
export type EntityPendingAction = {
  id: string; runId: string; skillId: string;
  draft: Record<string, unknown>; editedDraft: Record<string, unknown> | null;
  status: string; expiresAt: string; editableFields: string[];
};
export type RunConversationTurn = { role: "inbound" | "draft"; text: string };
export type RunTraceRow = { label: string; detail: unknown };
export type RunStats = {
  turns: number | null;
  steps: number;
  wallClockMs: number;
  tokensIn: number | null;
  tokensOut: number | null;
  ttftMs: number | null;
  cacheHitRate: number | null;
};
export type EntityViewRun = {
  id: string;
  skillId: string;
  status: string;
  createdAt: string;
  conversation: RunConversationTurn[];
  trace: RunTraceRow[];
  stats: RunStats | null;
};
export type EntityViewData = {
  id: string; skillId: string; title: string; subtitle?: string;
  fields: EntityField[]; stages: EntityStage[]; currentStage: string;
  runs: EntityViewRun[];
  contact: EntityContact;
  documents: EntityDocument[];
  pendingActions: EntityPendingAction[];
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
