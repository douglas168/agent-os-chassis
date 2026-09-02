import { echoSkill } from "./echo";
import { arReminderSkill } from "./ar-reminder";
import type { Skill } from "./contract";

export * from "./contract";
export * from "./schema";
export { echoSkill } from "./echo";
export { arReminderSkill } from "./ar-reminder";
export { defineSkill } from "./define-skill";
export { fixtureMessage, runSkillLoop } from "./testing";
export const SKILLS: Skill<any, any>[] = [echoSkill, arReminderSkill];
