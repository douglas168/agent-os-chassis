import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { organization, orgSkillConfig } from "../src/db/schema";
import { createOrgSkillConfigRepo } from "../src/repositories/org-skill-config";

describe("org_skill_config repository", () => {
  let org: { id: string } | undefined;

  afterEach(async () => {
    if (!org) return;
    await db.delete(orgSkillConfig).where(eq(orgSkillConfig.orgId, org.id));
    await db.delete(organization).where(eq(organization.id, org.id));
    org = undefined;
  });

  it("upsert creates then updates the same org+skill row", async () => {
    [org] = await db.insert(organization).values({
      id: crypto.randomUUID(),
      name: "Skills Org",
      slug: `skills-org-${crypto.randomUUID()}`,
      createdAt: new Date(),
    }).returning();
    const repo = createOrgSkillConfigRepo(db);
    const ctx = { orgId: org.id, userId: "system", role: "owner" };

    const created = await repo.upsert(ctx, "ar-reminder", {
      enabled: true,
      config: { reminderToneHint: "friendly" },
    });
    expect(created.config).toEqual({ reminderToneHint: "friendly" });

    const updated = await repo.upsert(ctx, "ar-reminder", {
      enabled: false,
      config: { reminderToneHint: "formal" },
    });
    expect(updated.id).toBe(created.id);
    expect(updated.enabled).toBe(false);

    const rows = await repo.listForOrg(ctx);
    expect(rows).toHaveLength(1);
  });

  it("findOne returns null for a skill with no row yet, org-scoped", async () => {
    [org] = await db.insert(organization).values({
      id: crypto.randomUUID(),
      name: "Skills Org 2",
      slug: `skills-org2-${crypto.randomUUID()}`,
      createdAt: new Date(),
    }).returning();
    const repo = createOrgSkillConfigRepo(db);
    const found = await repo.findOne({ orgId: org.id, userId: "system", role: "owner" }, "echo");
    expect(found).toBeNull();
  });
});
