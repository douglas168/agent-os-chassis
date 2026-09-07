import { NextResponse } from "next/server";
import { db, createOrgSkillConfigRepo } from "@agentos/core";
import { SKILLS, describeConfigFields } from "@agentos/skills";
import { resolveOrgContext } from "../../../lib/context";

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const rows = await createOrgSkillConfigRepo(db).listForOrg(ctx);
  const byId = new Map(rows.map((row) => [row.skillId, row]));

  return NextResponse.json(SKILLS.map((skill) => {
    const row = byId.get(skill.manifest.id);
    return {
      id: skill.manifest.id,
      name: skill.manifest.name,
      description: skill.manifest.description,
      hasConfig: Boolean(skill.manifest.configSchema),
      configFields: skill.manifest.configSchema
        ? describeConfigFields(skill.manifest.configSchema)
        : [],
      enabled: row?.enabled ?? true,
      config: row?.config ?? {},
    };
  }));
}
