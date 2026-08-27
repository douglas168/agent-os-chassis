import { and, eq } from "drizzle-orm";
import type { db as Db } from "../db/client";
import { messages } from "../db/schema";
import type { OrgContext } from "../context";

export function createMessagesRepo(db: typeof Db) {
  return {
    async create(ctx: OrgContext, input: Omit<typeof messages.$inferInsert, "id" | "orgId" | "createdAt">) {
      const [row] = await db.insert(messages).values({ ...input, orgId: ctx.orgId }).returning();
      return row;
    },
    async listForOrg(ctx: OrgContext) {
      return db.select().from(messages).where(eq(messages.orgId, ctx.orgId));
    },
  };
}
