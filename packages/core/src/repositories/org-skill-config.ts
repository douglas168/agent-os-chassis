import { and, eq } from "drizzle-orm";
import type { db as Db } from "../db/client";
import { orgSkillConfig } from "../db/schema";
import type { OrgContext } from "../context";

export function createOrgSkillConfigRepo(db: typeof Db) {
  return {
    async upsert(
      ctx: OrgContext,
      skillId: string,
      input: { enabled: boolean; config: Record<string, unknown> },
    ) {
      const existing = await this.findOne(ctx, skillId);
      if (existing) {
        const [row] = await db.update(orgSkillConfig)
          .set({ enabled: input.enabled, config: input.config, updatedAt: new Date() })
          .where(and(eq(orgSkillConfig.orgId, ctx.orgId), eq(orgSkillConfig.id, existing.id)))
          .returning();
        return row;
      }

      const [row] = await db.insert(orgSkillConfig)
        .values({ orgId: ctx.orgId, skillId, enabled: input.enabled, config: input.config })
        .returning();
      return row;
    },

    async findOne(ctx: OrgContext, skillId: string) {
      const rows = await db.select().from(orgSkillConfig).where(
        and(eq(orgSkillConfig.orgId, ctx.orgId), eq(orgSkillConfig.skillId, skillId)),
      );
      return rows[0] ?? null;
    },

    async listForOrg(ctx: OrgContext) {
      return db.select().from(orgSkillConfig).where(eq(orgSkillConfig.orgId, ctx.orgId));
    },
  };
}
