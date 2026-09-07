import { and, eq, sql } from "drizzle-orm";
import type { db as Db } from "../db/client";
import { contacts } from "../db/schema";
import type { OrgContext } from "../context";

export function createContactsRepo(db: typeof Db) {
  return {
    async listForOrg(ctx: OrgContext) {
      return db.select().from(contacts).where(eq(contacts.orgId, ctx.orgId));
    },

    async findByEmail(ctx: OrgContext, email: string) {
      const rows = await db.select().from(contacts).where(
        and(eq(contacts.orgId, ctx.orgId), sql`${contacts.emails} @> ${JSON.stringify([email])}::jsonb`),
      );
      return rows[0] ?? null;
    },
  };
}
