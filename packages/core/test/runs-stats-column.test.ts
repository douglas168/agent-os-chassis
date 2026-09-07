import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { organization, runs } from "../src/db/schema";

describe("runs.stats column", () => {
  const orgIds: string[] = [];
  const runIds: string[] = [];

  afterEach(async () => {
    for (const id of runIds.splice(0)) await db.delete(runs).where(eq(runs.id, id));
    for (const id of orgIds.splice(0)) await db.delete(organization).where(eq(organization.id, id));
  });

  it("stores and reads back a stats object", async () => {
    const [org] = await db.insert(organization).values({ id: crypto.randomUUID(), name: "Stats Org", slug: `stats-org-${crypto.randomUUID()}`, createdAt: new Date() }).returning();
    orgIds.push(org.id);
    const [row] = await db.insert(runs).values({
      orgId: org.id, skillId: "echo", mastraRunId: `mr-stats-${crypto.randomUUID()}`,
      stats: { turns: null, steps: 3, wallClockMs: 420, tokensIn: null, tokensOut: null, ttftMs: null, cacheHitRate: null },
    }).returning();
    runIds.push(row.id);
    expect(row.stats).toEqual({ turns: null, steps: 3, wallClockMs: 420, tokensIn: null, tokensOut: null, ttftMs: null, cacheHitRate: null });
  });

  it("defaults stats to null when not supplied", async () => {
    const [org] = await db.insert(organization).values({ id: crypto.randomUUID(), name: "Stats Org 2", slug: `stats-org2-${crypto.randomUUID()}`, createdAt: new Date() }).returning();
    orgIds.push(org.id);
    const [row] = await db.insert(runs).values({ orgId: org.id, skillId: "echo", mastraRunId: `mr-stats2-${crypto.randomUUID()}` }).returning();
    runIds.push(row.id);
    expect(row.stats).toBeNull();
  });
});
