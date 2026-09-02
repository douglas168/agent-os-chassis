import { and, eq, or, lt } from "drizzle-orm";
import type { db as Db } from "../db/client";
import { actions } from "../db/schema";
import type { OrgContext } from "../context";

const pendingStatus = "pending" as const;

export function createActionsRepo(db: typeof Db) {
  return {
    async create(ctx: OrgContext, input: Omit<typeof actions.$inferInsert, "id" | "orgId" | "createdAt" | "status">) {
      const [row] = await db.insert(actions).values({ ...input, orgId: ctx.orgId, status: "pending" }).returning();
      return row;
    },
    async listPending(ctx: OrgContext) {
      return db.select().from(actions).where(and(eq(actions.orgId, ctx.orgId), eq(actions.status, pendingStatus)));
    },
    async findById(ctx: OrgContext, id: string) {
      const rows = await db.select().from(actions).where(and(eq(actions.orgId, ctx.orgId), eq(actions.id, id)));
      return rows[0] ?? null;
    },
    async decide(ctx: OrgContext, id: string, status: "approved" | "denied", decidedBy: string) {
      const [row] = await db.update(actions)
        .set({ status, decidedBy, decidedAt: new Date() })
        .where(and(eq(actions.orgId, ctx.orgId), eq(actions.id, id), eq(actions.status, "pending")))
        .returning();
      return row;
    },
    async setEditedDraft(ctx: OrgContext, id: string, editedDraft: unknown) {
      const [row] = await db.update(actions).set({ editedDraft })
        .where(and(eq(actions.orgId, ctx.orgId), eq(actions.id, id), eq(actions.status, "pending")))
        .returning();
      return row;
    },
    async releaseExecuting(ctx: OrgContext, id: string, expectedExecutingSince: Date, status: "done" | "failed") {
      // finding 3 (Plan 3 final review): the predicate has to identify the
      // *claim* (status AND the executingSince it was stamped with), not
      // just the state — a status-only CAS lets a reclaimer's fresh claim
      // get overwritten by a stale attempt that still thinks it owns the row.
      const [row] = await db.update(actions)
        .set({ status })
        .where(and(
          eq(actions.orgId, ctx.orgId),
          eq(actions.id, id),
          eq(actions.status, "executing"),
          eq(actions.executingSince, expectedExecutingSince),
        ))
        .returning();
      return row ?? null;
    },
    async transitionStatus(ctx: OrgContext, id: string, from: string, to: string) {
      const [row] = await db.update(actions)
        // Stamp executingSince whenever a row enters "executing" — Task 8's
        // reclaimForRetry needs this set on every entry into that state.
        .set({ status: to, ...(to === "executing" ? { executingSince: new Date() } : {}) })
        .where(and(eq(actions.orgId, ctx.orgId), eq(actions.id, id), eq(actions.status, from)))
        .returning();
      return row;
    },
    async reclaimForRetry(ctx: OrgContext, id: string, staleExecutingMs: number) {
      const staleCutoff = new Date(Date.now() - staleExecutingMs);
      // Claims either a normal "failed" row, or an "executing" row stranded
      // long enough (LCD10) that it is treated as abandoned rather than
      // genuinely in flight — the latter clause is what lets a crash between
      // transitionStatus's claim and resumeAndFinish's completion (finding 15)
      // recover at all; the former is retryAction's original behavior.
      const [row] = await db.update(actions)
        .set({ status: "executing", executingSince: new Date() })
        .where(and(
          eq(actions.orgId, ctx.orgId),
          eq(actions.id, id),
          or(
            eq(actions.status, "failed"),
            and(eq(actions.status, "executing"), lt(actions.executingSince, staleCutoff)),
          ),
        ))
        .returning();
      return row;
    },
  };
}
