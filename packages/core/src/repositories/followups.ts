import { and, eq, lte } from "drizzle-orm";
import type { db as Db } from "../db/client";
import { followUps, actions, runs, messages } from "../db/schema";
import type { OrgContext } from "../context";

// adversarial-plan-review round 1, finding 8: a disclosed policy choice, not
// a measured figure — large enough that a normal tick clears its backlog in
// one pass, small enough that one sweep tick can't starve the worker's other
// job (sweepExpiredActions) behind an unbounded follow-up backlog.
const FOLLOWUP_SWEEP_BATCH_SIZE = 100;

export function createFollowUpsRepo(db: typeof Db) {
  return {
    async schedule(ctx: OrgContext, input: { actionId: string; skillId: string; dueAt: Date; touchIndex: number }) {
      // adversarial-plan-review round 1, finding 10: verify that actionId
      // actually belongs to the caller's organization before inserting.
      const [action] = await db.select({ orgId: actions.orgId }).from(actions).where(eq(actions.id, input.actionId));
      if (!action || action.orgId !== ctx.orgId) {
        throw new Error(`action ${input.actionId} does not belong to org ${ctx.orgId}`);
      }
      const [row] = await db.insert(followUps)
        .values({ ...input, orgId: ctx.orgId })
        .onConflictDoNothing({ target: [followUps.actionId, followUps.touchIndex] })
        .returning();
      return row ?? null;
    },
    // Cross-org by design: the worker sweep (Task 5) has no per-request
    // OrgContext to scope this to. Each returned row carries its own orgId.
    // A due row not claimed this tick is picked up by the next one because
    // dueAt is already in the past.
    async listDue() {
      return db.select().from(followUps)
        .where(and(eq(followUps.status, "scheduled"), lte(followUps.dueAt, new Date())))
        .limit(FOLLOWUP_SWEEP_BATCH_SIZE);
    },
    async markStatus(ctx: OrgContext, id: string, status: string) {
      const [row] = await db.update(followUps).set({ status })
        .where(and(eq(followUps.orgId, ctx.orgId), eq(followUps.id, id))).returning();
      return row;
    },
    // Spec § 4.4: an inbound message matched to the same contact cancels that
    // contact's scheduled follow-ups. Joins through actions -> runs ->
    // messages to find which scheduled follow-ups trace back to this contact.
    async cancelScheduledForContact(ctx: OrgContext, contactId: string, reason: string) {
      const rows = await db.select({ id: followUps.id })
        .from(followUps)
        .innerJoin(actions, eq(actions.id, followUps.actionId))
        .innerJoin(runs, eq(runs.id, actions.runId))
        .innerJoin(messages, eq(messages.id, runs.messageId))
        .where(and(
          eq(followUps.orgId, ctx.orgId), eq(followUps.status, "scheduled"), eq(messages.contactId, contactId),
        ));
      for (const row of rows) {
        await db.update(followUps).set({ status: "cancelled" }).where(eq(followUps.id, row.id));
      }
      return { cancelled: rows.length, reason };
    },
  };
}
