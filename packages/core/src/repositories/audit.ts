import { desc, eq } from "drizzle-orm";
import type { db as Db } from "../db/client";
import { auditLog } from "../db/schema";
import type { OrgContext } from "../context";

export function createAuditRepo(db: typeof Db) {
  return {
    async listForOrg(ctx: OrgContext) {
      return db.select().from(auditLog)
        .where(eq(auditLog.orgId, ctx.orgId))
        .orderBy(desc(auditLog.createdAt));
    },

    async record(ctx: OrgContext, input: Omit<typeof auditLog.$inferInsert, "id" | "orgId" | "createdAt">) {
      const [row] = await db.insert(auditLog).values({ ...input, orgId: ctx.orgId }).returning();
      return row;
    },
  };
}
