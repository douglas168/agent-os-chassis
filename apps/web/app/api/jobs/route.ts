import { NextResponse } from "next/server";
import { db, createFollowUpsRepo, createRunsRepo } from "@agentos/core";
import { SKILLS } from "@agentos/skills";
import { resolveOrgContext } from "../../../lib/context";

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch (err) {
    console.error("resolveOrgContext failed:", err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const followUps = await createFollowUpsRepo(db).listForOrg(ctx);
  const runsRepo = createRunsRepo(db);
  const cronSkills = await Promise.all(
    SKILLS.filter((s) => s.trigger.kind === "cron").map(async (s) => {
      const lastRun = await runsRepo.findLatestForSkill(ctx, s.manifest.id);
      return {
        skillId: s.manifest.id,
        intervalMs: (s.trigger as { kind: "cron"; intervalMs: number }).intervalMs,
        lastRun: lastRun ? { status: lastRun.status, createdAt: lastRun.createdAt } : null,
      };
    }),
  );

  return NextResponse.json({ followUps, cronSkills });
}
