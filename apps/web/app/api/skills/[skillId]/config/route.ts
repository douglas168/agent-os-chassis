import { NextResponse } from "next/server";
import { db, createOrgSkillConfigRepo, can } from "@agentos/core";
import { SKILLS } from "@agentos/skills";
import { resolveOrgContext } from "../../../../../lib/context";

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ skillId: string }> },
) {
  let ctx;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  if (!can(ctx.role, { action: ["approve"] })) {
    return NextResponse.json({ error: "insufficient role" }, { status: 403 });
  }

  const { skillId } = await params;
  const skill = SKILLS.find((candidate) => candidate.manifest.id === skillId);
  if (!skill) return NextResponse.json({ error: "unknown skill" }, { status: 404 });

  const body = await req.json();
  const repo = createOrgSkillConfigRepo(db);
  const existing = await repo.findOne(ctx, skillId);
  const config = body.config !== undefined ? body.config : (existing?.config ?? {});

  if (body.config !== undefined && skill.manifest.configSchema) {
    const parsed = skill.manifest.configSchema.safeParse(config);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.message }, { status: 400 });
    }
  }

  const updated = await repo.upsert(ctx, skillId, {
    enabled: body.enabled ?? existing?.enabled ?? true,
    config,
  });
  return NextResponse.json(updated);
}
