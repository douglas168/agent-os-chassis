import { echoSkill } from "./echo";
import type { Skill } from "./contract";

export * from "./contract";
export const SKILLS: Skill[] = [echoSkill];
