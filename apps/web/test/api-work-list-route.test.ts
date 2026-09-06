import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { inArray } from "drizzle-orm";
import { db, member, organization, runs, createRunsRepo } from "@agentos/core";
import { GET } from "../app/api/work/route";
import { auth } from "../lib/auth";

describe("GET /api/work", () => {
  let orgAId: string;
  let orgBId: string;
  let userAId: string;
  let userBId: string;
  let ownerAHeaders: Headers;
  let ownerBHeaders: Headers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const test = ctx.test;

    const userA = test.createUser({ email: "work-list-owner-a@example.com" });
    await test.saveUser(userA);
    userAId = userA.id;
    const orgA = await auth.api.createOrganization({
      body: { name: "Work List Org A", slug: "work-list-org-a", userId: userA.id },
    });
    orgAId = orgA!.id;
    ownerAHeaders = await test.getAuthHeaders({ userId: userA.id });

    const userB = test.createUser({ email: "work-list-owner-b@example.com" });
    await test.saveUser(userB);
    userBId = userB.id;
    const orgB = await auth.api.createOrganization({
      body: { name: "Work List Org B", slug: "work-list-org-b", userId: userB.id },
    });
    orgBId = orgB!.id;
    ownerBHeaders = await test.getAuthHeaders({ userId: userB.id });
  });

  afterEach(async () => {
    await db.delete(runs).where(inArray(runs.orgId, [orgAId, orgBId]));
  });

  afterAll(async () => {
    await db.delete(runs).where(inArray(runs.orgId, [orgAId, orgBId]));
    await db.delete(member).where(inArray(member.organizationId, [orgAId, orgBId]));
    await db.delete(organization).where(inArray(organization.id, [orgAId, orgBId]));
    const ctx = await auth.$context;
    await ctx.test.deleteUser(userAId);
    await ctx.test.deleteUser(userBId);
  });

  it("lists recent runs for the caller's org with failed-step detail and isolates other orgs", async () => {
    const runsRepo = createRunsRepo(db);
    const ctxA = { orgId: orgAId, userId: "system", role: "owner" };
    const running = await runsRepo.create(ctxA, { skillId: "echo", mastraRunId: "mr-work-running" });
    const failed = await runsRepo.create(ctxA, { skillId: "echo", mastraRunId: "mr-work-failed" });
    await runsRepo.updateStatus(ctxA, failed.id, "failed", {
      error: "boom",
      failedStep: "execute",
      failedInput: { draft: {} },
    });

    const otherOrgRun = await runsRepo.create(
      { orgId: orgBId, userId: "system", role: "owner" },
      { skillId: "other-skill", mastraRunId: "mr-work-other-org" },
    );

    const orgAResponse = await GET(new Request("http://localhost:3000/api/work", { headers: ownerAHeaders }));
    const orgARuns = await orgAResponse.json();

    expect(orgAResponse.status).toBe(200);
    expect(orgARuns.map((run: { id: string }) => run.id)).toEqual([failed.id, running.id]);
    expect(orgARuns[0].failedStep).toBe("execute");
    expect(orgARuns[0].failedInput).toEqual({ draft: {} });
    expect(orgARuns.some((run: { id: string }) => run.id === otherOrgRun.id)).toBe(false);

    const orgBResponse = await GET(new Request("http://localhost:3000/api/work", { headers: ownerBHeaders }));
    const orgBRuns = await orgBResponse.json();

    expect(orgBResponse.status).toBe(200);
    expect(orgBRuns.map((run: { id: string }) => run.id)).toEqual([otherOrgRun.id]);
    expect(orgBRuns.some((run: { id: string }) => run.id === running.id)).toBe(false);
  });

  it("returns 401 when the caller has no session", async () => {
    const response = await GET(new Request("http://localhost:3000/api/work"));

    expect(response.status).toBe(401);
  });
});
