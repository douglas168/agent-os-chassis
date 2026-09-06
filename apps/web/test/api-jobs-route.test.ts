import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { actions, db, followUps, member, organization, createRunsRepo, runs } from "@agentos/core";
import { GET } from "../app/api/jobs/route";
import { auth } from "../lib/auth";

describe("GET /api/jobs", () => {
  let orgId: string;
  let userId: string;
  let headers: Headers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const user = ctx.test.createUser({ email: "jobs-user@example.com" });
    await ctx.test.saveUser(user);
    userId = user.id;
    const org = await auth.api.createOrganization({
      body: { name: "Jobs Test Org", slug: "jobs-test-org", userId },
    });
    orgId = org!.id;
    headers = await ctx.test.getAuthHeaders({ userId });
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

  it("returns this org's follow-ups and cron skill state", async () => {
    const repo = createRunsRepo(db);
    const ctx = { orgId, userId: "system", role: "owner" };
    const run = await repo.create(ctx, { skillId: "ar-reminder", mastraRunId: "mr-jobs-1" });
    await repo.updateStatus(ctx, run.id, "done");
    const [action] = await db.insert(actions).values({
      id: crypto.randomUUID(), orgId, runId: run.id, skillId: "ar-reminder", kind: "reply", draft: {},
      idempotencyKey: `${run.id}:draft`, expiresAt: new Date(Date.now() + 86_400_000),
    }).returning();
    const dueAt = new Date(Date.now() + 3_600_000);
    const [followUp] = await db.insert(followUps).values({
      id: crypto.randomUUID(), orgId, actionId: action.id, skillId: "ar-reminder",
      dueAt, status: "scheduled", touchIndex: 0,
    }).returning();

    const res = await GET(new Request("http://localhost:3000/api/jobs", { headers }));
    const json = await res.json();

    expect(res.status).toBe(200);
    expect(json.followUps).toEqual(expect.arrayContaining([
      expect.objectContaining({
        id: followUp.id,
        skillId: "ar-reminder",
        status: "scheduled",
        dueAt: dueAt.toISOString(),
      }),
    ]));
    expect(json.cronSkills).toEqual(expect.arrayContaining([
      {
        skillId: "ar-reminder",
        intervalMs: 86_400_000,
        lastRun: { status: expect.any(String), createdAt: expect.any(String) },
      },
    ]));
  });

  it("returns 401 when the caller has no session", async () => {
    const res = await GET(new Request("http://localhost:3000/api/jobs"));
    expect(res.status).toBe(401);
  });
});
