import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
import { defineSkill, SKILLS } from "@agentos/skills";

let mastra: Mastra | undefined;

export function getMastra(): Mastra {
  if (mastra) return mastra;
  const storage = new PostgresStore({ id: "agentos-store", connectionString: process.env.DATABASE_URL! });
  const workflows = Object.fromEntries(
    SKILLS.map((skill) => [`${skill.manifest.id}-workflow`, defineSkill(skill)]),
  );
  mastra = new Mastra({ workflows, storage });
  return mastra;
}
