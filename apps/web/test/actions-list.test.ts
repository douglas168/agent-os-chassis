import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import {
  db, organization, member, messages, runs, actions,
  createActionsRepo, createRunsRepo,
} from "@agentos/core";
import { auth } from "../lib/auth";
import { matchAndRun } from "../lib/router";
import { GET } from "../app/api/actions/route";

describe("GET /api/actions", () => {
  let ownerId: string;
  let orgId: string;
  let ownerHeaders: Headers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const test = ctx.test;
    const owner = test.createUser({ email: "actions-list-owner@example.com" });
    await test.saveUser(owner);
    ownerId = owner.id;
    const org = await auth.api.createOrganization({
      body: { name: "Actions List Test Org", slug: "actions-list-test-org", userId: owner.id },
    });
    orgId = org!.id;
    ownerHeaders = await test.getAuthHeaders({ userId: owner.id });
  });

  afterEach(async () => {
    await db.delete(actions); await db.delete(runs); await db.delete(messages);
  });

  afterAll(async () => {
    await db.delete(member);
    await db.delete(organization);
    const ctx = await auth.$context;
    await ctx.test.deleteUser(ownerId);
  });

  it("lists pending actions for the current org", async () => {
    await matchAndRun({
      from: "customer@example.com", to: "ops@example.com",
      subject: "Hi", body: "Hello there", providerMessageId: "p-list-1",
    });

    const req = new Request("http://localhost:3000/api/actions", { headers: ownerHeaders });
    const res = await GET(req);
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].status).toBe("pending");
  });

  it("includes editableFields for each returned action, sourced from the skill's own declaration", async () => {
    await matchAndRun({
      from: "editable@example.com", to: "ops@example.com",
      subject: "Editable", body: "Edit me", providerMessageId: "p-list-edit-1",
    });

    const req = new Request("http://localhost:3000/api/actions", { headers: ownerHeaders });
    const json = await (await GET(req)).json();
    expect(json[0].editableFields).toEqual(["subject", "body"]);
  });

  it("returns expired actions when ?status=expired is given (finding 11)", async () => {
    const runsRepo = createRunsRepo(db);
    const actionsRepo = createActionsRepo(db);
    const ctx = { orgId, userId: "system", role: "owner" };
    const run = await runsRepo.create(ctx, { skillId: "echo", mastraRunId: "mr-expired-1" });
    const action = await actionsRepo.create(ctx, {
      runId: run.id, skillId: "echo", kind: "reply", draft: {},
      expiresAt: new Date(Date.now() - 1000), idempotencyKey: crypto.randomUUID(),
    });
    await db.update(actions).set({ status: "expired" }).where(eq(actions.id, action.id));

    const req = new Request("http://localhost:3000/api/actions?status=expired", { headers: ownerHeaders });
    const json = await (await GET(req)).json();
    expect(json.some((a: { id: string }) => a.id === action.id)).toBe(true);
  });
});
