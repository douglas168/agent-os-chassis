import { and, desc, eq, sql } from "drizzle-orm";
import type { db as Db } from "../db/client";
import { documents } from "../db/schema";
import type { OrgContext } from "../context";

type CreateInput = {
  title: string;
  source: "upload" | "message-attachment";
  mime: string;
  sizeBytes: number;
  storageKey: string;
  text: string | null;
  entityRef?: { table: string; id: string } | null;
};

export function createDocumentsRepo(db: typeof Db) {
  return {
    async create(ctx: OrgContext, input: CreateInput) {
      const { text, entityRef, ...rest } = input;
      const [row] = await db.insert(documents).values({
        ...rest,
        orgId: ctx.orgId,
        entityRef: entityRef ?? null,
        // tsvector has no implicit cast from text. Build it with the same
        // language configuration used by the existing database migration.
        extractedText: text === null ? null : sql`to_tsvector('english', ${text})`,
      }).returning();
      return row;
    },

    async findById(ctx: OrgContext, id: string) {
      const rows = await db.select().from(documents).where(
        and(eq(documents.orgId, ctx.orgId), eq(documents.id, id)),
      );
      return rows[0] ?? null;
    },

    async listForOrg(ctx: OrgContext) {
      return db.select().from(documents)
        .where(eq(documents.orgId, ctx.orgId))
        .orderBy(desc(documents.createdAt));
    },

    async search(ctx: OrgContext, query: string) {
      return db.select().from(documents).where(
        and(
          eq(documents.orgId, ctx.orgId),
          sql`${documents.extractedText} @@ plainto_tsquery('english', ${query})`,
        ),
      ).orderBy(desc(documents.createdAt));
    },
  };
}
