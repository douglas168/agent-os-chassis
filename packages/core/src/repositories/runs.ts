import { and, eq, desc, sql } from "drizzle-orm";
import type { db as Db } from "../db/client";
import { runs } from "../db/schema";
import type { OrgContext } from "../context";

export function createRunsRepo(db: typeof Db) {
  return {
    async create(ctx: OrgContext, input: Omit<typeof runs.$inferInsert, "id" | "orgId" | "createdAt" | "updatedAt" | "status">) {
      const [row] = await db.insert(runs).values({ ...input, orgId: ctx.orgId, status: "running" }).returning();
      return row;
    },
    async updateStatus(ctx: OrgContext, id: string, status: string, extra: Partial<typeof runs.$inferInsert> = {}) {
      const [row] = await db.update(runs).set({ status, updatedAt: new Date(), ...extra })
        .where(and(eq(runs.orgId, ctx.orgId), eq(runs.id, id))).returning();
      return row;
    },
    async findByMastraRunId(ctx: OrgContext, mastraRunId: string) {
      const rows = await db.select().from(runs).where(and(eq(runs.orgId, ctx.orgId), eq(runs.mastraRunId, mastraRunId)));
      return rows[0] ?? null;
    },
    async findById(ctx: OrgContext, id: string) {
      const rows = await db.select().from(runs).where(and(eq(runs.orgId, ctx.orgId), eq(runs.id, id)));
      return rows[0] ?? null;
    },
    async listForOrg(ctx: OrgContext) {
      return db.select().from(runs).where(eq(runs.orgId, ctx.orgId)).orderBy(desc(runs.createdAt));
    },
    async findForEntity(ctx: OrgContext, entityRef: { table: string; id: string }) {
      return db.select().from(runs).where(
        and(eq(runs.orgId, ctx.orgId), sql`${runs.entityRef} @> ${JSON.stringify(entityRef)}::jsonb`),
      ).orderBy(desc(runs.createdAt));
    },
  };
}
