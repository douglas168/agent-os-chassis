import { eq } from "drizzle-orm";
import { createFollowUpsRepo } from "../repositories/followups";
import { db } from "../db/client";
import { actions, runs, followUps } from "../db/schema";
import type { OrgContext } from "../context";
import type { Skill } from "@agentos/skills";

export async function scheduleFollowUpsForAction(
  ctx: OrgContext,
  skill: Skill<any, any>,
  actionId: string,
): Promise<number> {
  if (!skill.followups?.offsets.length) return 0;

  // finding 11 (adversarial review round 1): a follow-up re-entry
  // (followup-sweep.ts) always reuses the origin message's id for the run
  // it creates — so "does any follow_ups row already exist for an action
  // sharing this action's origin messageId" is exactly "is this action
  // itself a follow-up touch, not the original approval." Without this,
  // approving a follow-up-drafted action re-schedules a fresh offset set
  // forever.
  const [actionRow] = await db.select({ runId: actions.runId }).from(actions).where(eq(actions.id, actionId));
  if (!actionRow) return 0;
  const [runRow] = await db.select({ messageId: runs.messageId }).from(runs).where(eq(runs.id, actionRow.runId));
  if (runRow?.messageId) {
    const [already] = await db.select({ id: followUps.id })
      .from(followUps)
      .innerJoin(actions, eq(actions.id, followUps.actionId))
      .innerJoin(runs, eq(runs.id, actions.runId))
      .where(eq(runs.messageId, runRow.messageId))
      .limit(1);
    if (already) return 0;
  }

  const followUpsRepo = createFollowUpsRepo(db);
  let scheduled = 0;
  for (const [touchIndex, offsetDays] of skill.followups.offsets.entries()) {
    const dueAt = new Date(Date.now() + offsetDays * 24 * 60 * 60 * 1000);
    const row = await followUpsRepo.schedule(ctx, { actionId, skillId: skill.manifest.id, dueAt, touchIndex });
    if (row) scheduled += 1;
  }
  return scheduled;
}
