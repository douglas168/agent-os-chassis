import { and, eq } from "drizzle-orm";
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
    async markStatus(ctx: OrgContext, id: string, status: string) {
      const [row] = await db.update(actions).set({ status })
        .where(and(eq(actions.orgId, ctx.orgId), eq(actions.id, id))).returning();
      return row;
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
  };
}
