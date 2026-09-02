import type { Skill } from "../contract";
import { manifest } from "./manifest";
import { trigger } from "./trigger";
import { understand, ArReminderIntentSchema, type ArReminderIntent } from "./understand";
import { draft, ArReminderDraftSchema, editableFields, type ArReminderDraft } from "./draft";
import { execute } from "./execute";
import { followups } from "./followups";
import { entity } from "./entity";

export const arReminderSkill: Skill<ArReminderIntent, ArReminderDraft> = {
  manifest, trigger, understand, draft, execute, followups, entity,
  intentSchema: ArReminderIntentSchema, draftSchema: ArReminderDraftSchema, editableFields,
};
