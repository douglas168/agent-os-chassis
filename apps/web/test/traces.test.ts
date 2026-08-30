import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization, member, messages, runs, actions, createRunsRepo } from "@agentos/core";
import { GET } from "../app/api/traces/route";
import { auth } from "../lib/auth";

describe("GET /api/traces", () => {
  let orgId: string, createdUserId: string;

  beforeAll(async () => {
    const ctx2 = await auth.$context;
    const test = ctx2.test;
    const user = test.createUser({ email: "traces-user@example.com" });
    await test.saveUser(user);
    createdUserId = user.id;
    const org = await auth.api.createOrganization({ body: { name: "Traces Test Org", slug: "traces-test-org", userId: user.id } });
    orgId = org!.id;
  });
  afterEach(async () => { await db.delete(actions); await db.delete(runs); await db.delete(messages); });
  afterAll(async () => {
    // member rows (auth.api.createOrganization above) reference
    // organization.id — delete member first. Every test file in this plan
    // shares one real Postgres DB (fileParallelism: false), so leaving the
    // org row behind strands the next file's "exactly one org" invariant
    // (resolveChannelOrgContext) — same pattern as cross-org.test.ts.
    await db.delete(member);
    await db.delete(organization);
    const ctx2 = await auth.$context;
    await ctx2.test.deleteUser(createdUserId);
  });

  it("lists runs for the caller's org, most recent first, including failed-step detail", async () => {
    const runsRepo = createRunsRepo(db);
    const ctx = { orgId, userId: "system", role: "owner" };
    await runsRepo.create(ctx, { skillId: "echo", mastraRunId: "mr-trace-1" });
    const second = await runsRepo.create(ctx, { skillId: "echo", mastraRunId: "mr-trace-2" });
    await runsRepo.updateStatus(ctx, second.id, "failed", { error: "boom", failedStep: "execute", failedInput: { draft: {} } });

    const headers = await (await auth.$context).test.getAuthHeaders({ userId: createdUserId });
    const req = new Request("http://localhost:3000/api/traces", { headers });
    const res = await GET(req);
    const json = await res.json();

    expect(json).toHaveLength(2);
    expect(json[0].id).toBe(second.id); // most recent first
    expect(json[0].failedStep).toBe("execute");
    // adversarial-plan-review round 1, finding 6: failedInput was populated
    // in the DB but never asserted end-to-end through the API response.
    expect(json[0].failedInput).toEqual({ draft: {} });
  });

  it("returns 401 when the caller has no session", async () => {
    const req = new Request("http://localhost:3000/api/traces");
    const res = await GET(req);

    expect(res.status).toBe(401);
  });
});
