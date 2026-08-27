import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/db/client";
import { organizations } from "../src/db/schema";
import { resolveOrgContext } from "../src/context";

describe("resolveOrgContext", () => {
  beforeAll(async () => { await db.delete(organizations); });
  afterAll(async () => { await db.delete(organizations); });

  it("throws when no organization is seeded", async () => {
    await expect(resolveOrgContext()).rejects.toThrow(/no organization seeded/);
  });

  it("returns the seeded org's id once one exists", async () => {
    const [org] = await db.insert(organizations).values({ name: "Seeded Org" }).returning();
    const ctx = await resolveOrgContext();
    expect(ctx.orgId).toBe(org.id);
  });
});
