import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { actions, db, followUps, member, organization, runs } from "@agentos/core";
import { GET } from "../app/api/dashboard/route";
import { auth } from "../lib/auth";

describe("GET /api/dashboard", () => {
  let orgId: string;
  let userId: string;
  let headers: Headers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const test = ctx.test;
    const user = test.createUser({ email: "dashboard-user@example.com" });
    await test.saveUser(user);
    userId = user.id;
    const org = await auth.api.createOrganization({
      body: { name: "Dashboard Test Org", slug: "dashboard-test-org", userId },
    });
    orgId = org!.id;
    headers = await test.getAuthHeaders({ userId });
  });

  afterEach(async () => {
    await db.delete(followUps).where(eq(followUps.orgId, orgId));
    await db.delete(actions).where(eq(actions.orgId, orgId));
    await db.delete(runs).where(eq(runs.orgId, orgId));
  });

  afterAll(async () => {
    await db.delete(followUps).where(eq(followUps.orgId, orgId));
    await db.delete(actions).where(eq(actions.orgId, orgId));
    await db.delete(runs).where(eq(runs.orgId, orgId));
    await db.delete(member).where(eq(member.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
    const ctx = await auth.$context;
    await ctx.test.deleteUser(userId);
  });

  it("returns all KPI counts for the caller's organization", async () => {
    const now = new Date();
    const eightDaysAgo = new Date(now.getTime() - 8 * 24 * 60 * 60 * 1000);
    const [pendingRun, approvedRun, expiredRun] = await db.insert(runs).values([
      { id: crypto.randomUUID(), orgId, skillId: "echo", mastraRunId: "mr-dashboard-pending", status: "done" },
      { id: crypto.randomUUID(), orgId, skillId: "echo", mastraRunId: "mr-dashboard-approved", status: "done" },
      { id: crypto.randomUUID(), orgId, skillId: "echo", mastraRunId: "mr-dashboard-expired", status: "done" },
    ]).returning();
    const [pending, approved, expired] = await db.insert(actions).values([
      {
        id: crypto.randomUUID(), orgId, runId: pendingRun.id, skillId: "echo", kind: "reply", draft: {},
        status: "pending", expiresAt: new Date(now.getTime() + 3600_000),
        idempotencyKey: "dashboard-pending", createdAt: now,
      },
      {
        id: crypto.randomUUID(), orgId, runId: approvedRun.id, skillId: "echo", kind: "reply", draft: {},
        status: "approved", expiresAt: new Date(now.getTime() + 3600_000),
        idempotencyKey: "dashboard-approved", createdAt: eightDaysAgo,
      },
      {
        id: crypto.randomUUID(), orgId, runId: expiredRun.id, skillId: "echo", kind: "reply", draft: {},
        status: "expired", expiresAt: new Date(now.getTime() - 1000),
        idempotencyKey: "dashboard-expired", createdAt: now,
      },
    ]).returning();
    await db.insert(followUps).values({
      id: crypto.randomUUID(), orgId, actionId: pending.id, skillId: "echo",
      dueAt: new Date(now.getTime() - 60_000), status: "scheduled", touchIndex: 0,
    });

    const res = await GET(new Request("http://localhost:3000/api/dashboard", { headers }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({
      pendingApprovals: 1,
      actionsThisWeek: 2,
      followUpsDue: 1,
      actionsExpired: 1,
      outcomes: { approved: 1, denied: 0 },
    });
  });

  it("returns 401 when the caller has no session", async () => {
    const res = await GET(new Request("http://localhost:3000/api/dashboard"));

    expect(res.status).toBe(401);
  });
});
