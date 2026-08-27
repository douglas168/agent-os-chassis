import type { SkillTrigger } from "../contract";

export const trigger: SkillTrigger = { matches: (message) => message.channel === "mock" };
