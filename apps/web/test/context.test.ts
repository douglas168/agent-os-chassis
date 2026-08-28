import { describe, it, expect, afterAll } from "vitest";
import { db, organization, member, can } from "@agentos/core";
import { auth } from "../lib/auth";
import { resolveOrgContext, resolveChannelOrgContext } from "../lib/context";

describe("resolveOrgContext", () => {
  let createdUserId: string | undefined;

  afterAll(async () => {
    // Every test file in this plan shares one real Postgres DB
    // (fileParallelism: false) and resolveChannelOrgContext/resolveOrgContext
    // both require an exact org count — leaving this describe block's user
    // behind risks a duplicate-email failure on the next full-suite rerun.
    if (createdUserId) {
      const ctx = await auth.$context;
      await ctx.test.deleteUser(createdUserId);
    }
  });

  it("throws when there is no session", async () => {
    await expect(resolveOrgContext(new Headers())).rejects.toThrow(/no session/i);
  });

  it("auto-activates the sole org when the session has none active yet", async () => {
    const ctx = await auth.$context;
    const test = ctx.test;
    const user = test.createUser({ email: "ctx-owner@example.com" });
    await test.saveUser(user);
    createdUserId = user.id;
    await auth.api.createOrganization({
      body: { name: "Context Test Org", slug: "context-test-org", userId: user.id },
    });

    const headers = await test.getAuthHeaders({ userId: user.id });
    const orgCtx = await resolveOrgContext(headers);

    expect(orgCtx.userId).toBe(user.id);
    expect(orgCtx.role).toBe("owner");
    expect(typeof orgCtx.orgId).toBe("string");
  });
});

describe("resolveChannelOrgContext", () => {
  afterAll(async () => {
    // "returns the sole organization's id" / "throws when more than one"
    // both insert organization rows directly — clear them so the next test
    // file down the line still sees the "exactly one org" invariant this
    // function enforces, and so a full-suite rerun starts clean too.
    await db.delete(organization);
  });

  it("throws when no organization is seeded", async () => {
    // The previous describe block's "auto-activates" test created an org
    // via auth.api.createOrganization, which also writes a `member` row —
    // delete that first, or the FK on member.organizationId blocks this.
    await db.delete(member);
    await db.delete(organization);
    await expect(resolveChannelOrgContext()).rejects.toThrow(/no organization seeded/);
  });

  it("returns the sole organization's id, with a role that can never approve", async () => {
    // Insert directly (not via auth.api.createOrganization) since this test
    // needs an org with no attached user/member — supply id/createdAt
    // explicitly rather than relying on unverified DB-level column defaults.
    const [org] = await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Sole Org", slug: "sole-org", createdAt: new Date() })
      .returning();
    const ctx = await resolveChannelOrgContext();
    expect(ctx.orgId).toBe(org.id);
    expect(ctx.userId).toBe("system");
    // adversarial-plan-review round 1 finding 1 (sustained): an
    // unauthenticated ingestion path must not carry the highest role.
    expect(can(ctx.role, { action: ["approve"] })).toBe(false);
  });

  it("throws when more than one organization exists", async () => {
    await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Second Org", slug: "second-org", createdAt: new Date() });
    await expect(resolveChannelOrgContext()).rejects.toThrow(/multiple organizations/i);
  });
});
