import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db, actions, runs, messages, auditLog, organization, member } from "@agentos/core";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth";
import { matchAndRun } from "../lib/router";
import { GET } from "../app/api/actions/route";
import { PATCH } from "../app/api/actions/[id]/route";

describe("cross-org access", () => {
  let orgA: { id: string };
  let ownerAHeaders: Headers, ownerBHeaders: Headers, viewerAHeaders: Headers;
  let ownerAId: string, ownerBId: string, viewerAId: string;
  let actionIdInA: string;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const test = ctx.test;

    const ownerA = test.createUser({ email: "owner-a@example.com" });
    await test.saveUser(ownerA);
    ownerAId = ownerA.id;
    const orgAResult = await auth.api.createOrganization({ body: { name: "Org A", slug: "org-a-xorg", userId: ownerA.id } });
    orgA = { id: orgAResult!.id };
    ownerAHeaders = await test.getAuthHeaders({ userId: ownerA.id });

    const seeded = await matchAndRun({
      from: "customer@example.com", to: "ops@example.com",
      subject: "Hi", body: "Hello there", providerMessageId: "xorg-1",
    });
    actionIdInA = seeded.actionId;

    const ownerB = test.createUser({ email: "owner-b@example.com" });
    await test.saveUser(ownerB);
    ownerBId = ownerB.id;
    await auth.api.createOrganization({ body: { name: "Org B", slug: "org-b-xorg", userId: ownerB.id } });
    ownerBHeaders = await test.getAuthHeaders({ userId: ownerB.id });

    const viewerA = test.createUser({ email: "viewer-a@example.com" });
    await test.saveUser(viewerA);
    viewerAId = viewerA.id;
    await auth.api.addMember({ body: { organizationId: orgA.id, userId: viewerA.id, role: "viewer" } });
    viewerAHeaders = await test.getAuthHeaders({ userId: viewerA.id });
  });

  afterAll(async () => {
    await db.delete(auditLog);
    await db.delete(actions);
    await db.delete(runs);
    await db.delete(messages);
    // orgA/orgB/viewerA's membership rows (auth.api.createOrganization +
    // addMember above) reference organization.id — delete member first.
    await db.delete(member);
    await db.delete(organization);
    // Every test file in this plan shares one real Postgres DB
    // (fileParallelism: false) — leaving these users behind risks a
    // duplicate-email failure the next time the full suite reruns.
    const ctx = await auth.$context;
    await ctx.test.deleteUser(ownerAId);
    await ctx.test.deleteUser(ownerBId);
    await ctx.test.deleteUser(viewerAId);
  });

  it("GET /api/actions for org B never returns org A's action", async () => {
    const req = new Request("http://localhost:3000/api/actions", { headers: ownerBHeaders });
    const res = await GET(req);
    const json = await res.json();
    expect(json.find((a: any) => a.id === actionIdInA)).toBeUndefined();
  });

  it("PATCH /api/actions/:id from org B's owner cannot approve org A's action", async () => {
    const req = new Request(`http://localhost:3000/api/actions/${actionIdInA}`, {
      method: "PATCH", headers: ownerBHeaders, body: JSON.stringify({ decision: "approved" }),
    });
    // PATCH catches decideAction's throw and maps it to a real HTTP status
    // (Task 5) — assert on the response, not a rejected promise, since that's
    // what a real client over HTTP actually sees.
    const res = await PATCH(req, { params: Promise.resolve({ id: actionIdInA }) });
    expect(res.status).toBe(404);
    const json = await res.json();
    expect(json.error).toMatch(/no action/);
  });

  it("a viewer in the right org still cannot approve", async () => {
    const req = new Request(`http://localhost:3000/api/actions/${actionIdInA}`, {
      method: "PATCH", headers: viewerAHeaders, body: JSON.stringify({ decision: "approved" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: actionIdInA }) });
    expect(res.status).toBe(403);
    const json = await res.json();
    expect(json.error).toMatch(/cannot approve/);
  });

  it("the owner of the correct org can decide on the action (deny)", async () => {
    const req = new Request(`http://localhost:3000/api/actions/${actionIdInA}`, {
      method: "PATCH", headers: ownerAHeaders, body: JSON.stringify({ decision: "denied" }),
    });
    const res = await PATCH(req, { params: Promise.resolve({ id: actionIdInA }) });
    const json = await res.json();
    expect(json.status).toBe("denied");
  });
});
