import type { SkillTrigger } from "../contract";

export const trigger: SkillTrigger = { kind: "message", matches: (message) => message.channel === "mock" };
