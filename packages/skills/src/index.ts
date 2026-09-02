import { echoSkill } from "./echo";
import type { Skill } from "./contract";

export * from "./contract";
export { echoSkill } from "./echo";
export { defineSkill } from "./define-skill";
export const SKILLS: Skill<any, any>[] = [echoSkill];
