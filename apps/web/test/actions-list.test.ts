import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { db, organization, member, messages, runs, actions } from "@agentos/core";
import { auth } from "../lib/auth";
import { matchAndRun } from "../lib/router";
import { GET } from "../app/api/actions/route";

describe("GET /api/actions", () => {
  let ownerId: string;
  let ownerHeaders: Headers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const test = ctx.test;
    const owner = test.createUser({ email: "actions-list-owner@example.com" });
    await test.saveUser(owner);
    ownerId = owner.id;
    await auth.api.createOrganization({
      body: { name: "Actions List Test Org", slug: "actions-list-test-org", userId: owner.id },
    });
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
});
