import { beforeAll, afterAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization, member, messages, runs, actions, followUps } from "@agentos/core";
import { GET } from "../app/api/nav-counts/route";
import { auth } from "../lib/auth";

describe("GET /api/nav-counts", () => {
  let orgId: string;
  let userId: string;
  let headers: Headers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const test = ctx.test;
    const user = test.createUser({ email: "nav-counts-user@example.com" });
    await test.saveUser(user);
    userId = user.id;
    const org = await auth.api.createOrganization({
      body: { name: "Nav Counts Test Org", slug: "nav-counts-test-org", userId },
    });
    orgId = org!.id;
    headers = await test.getAuthHeaders({ userId });
  });

  afterAll(async () => {
    await db.delete(followUps).where(eq(followUps.orgId, orgId));
    await db.delete(actions).where(eq(actions.orgId, orgId));
    await db.delete(runs).where(eq(runs.orgId, orgId));
    await db.delete(messages).where(eq(messages.orgId, orgId));
    await db.delete(member).where(eq(member.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
    const ctx = await auth.$context;
    await ctx.test.deleteUser(userId);
  });

  it("returns pending approvals, due follow-ups, and unmatched inbound messages for the caller's org", async () => {
    const [run] = await db.insert(runs).values({
      id: crypto.randomUUID(), orgId, skillId: "echo", mastraRunId: "mr-nav-counts-1", status: "done",
    }).returning();
    const [action] = await db.insert(actions).values({
      id: crypto.randomUUID(), orgId, runId: run.id, skillId: "echo", kind: "reply", draft: {}, status: "pending",
      idempotencyKey: `${run.id}:draft`, expiresAt: new Date(Date.now() + 86_400_000),
    }).returning();
    await db.insert(followUps).values({
      id: crypto.randomUUID(), orgId, actionId: action.id, skillId: "echo",
      dueAt: new Date(Date.now() - 60_000), status: "scheduled", touchIndex: 0,
    });
    await db.insert(messages).values({
      id: crypto.randomUUID(), orgId, channel: "mock", direction: "in", providerMessageId: "nav-counts-inbound-1",
      from: "customer@example.com", to: "ops@example.com", body: "hello", contactId: null,
    });

    const res = await GET(new Request("http://localhost:3000/api/nav-counts", { headers }));

    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ approvals: 1, jobs: 1, inbox: 1 });
  });
});
