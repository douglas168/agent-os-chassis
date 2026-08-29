import type { Skill } from "../contract";
import { manifest } from "./manifest";
import { trigger } from "./trigger";
import { understand, type EchoIntent } from "./understand";
import { draft, EchoDraftSchema, editableFields, type EchoDraft } from "./draft";
import { execute } from "./execute";

export const echoSkill: Skill<EchoIntent, EchoDraft> = {
  manifest, trigger, understand, draft, execute,
  draftSchema: EchoDraftSchema, editableFields,
};
