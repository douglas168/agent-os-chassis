import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization, messages, runs, actions, createRunsRepo } from "@agentos/core";
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
});
