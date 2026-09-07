import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { auth } from "../lib/auth";
import { createRunsRepo, db, member, organization, runs } from "@agentos/core";
import { GET as getRun } from "../app/api/runs/[id]/route";

describe("GET /api/runs/[id]", () => {
  let ownerHeaders: Headers;
  let orgId: string;
  let ownerId: string;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const test = ctx.test;
    const owner = test.createUser({ email: "runs-route-owner@example.com" });
    await test.saveUser(owner);
    ownerId = owner.id;
    const org = await auth.api.createOrganization({
      body: {
        name: "Runs Route Org",
        slug: `runs-route-${crypto.randomUUID()}`,
        userId: ownerId,
      },
    });
    orgId = org!.id;
    ownerHeaders = await test.getAuthHeaders({ userId: ownerId });
  });

  afterAll(async () => {
    await db.delete(runs).where(eq(runs.orgId, orgId));
    await db.delete(member).where(eq(member.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
    await (await auth.$context).test.deleteUser(ownerId);
  });

  it("404s an unknown run id", async () => {
    const res = await getRun(
      new Request("http://localhost/api/runs/none", { headers: ownerHeaders }),
      { params: Promise.resolve({ id: crypto.randomUUID() }) },
    );
    expect(res.status).toBe(404);
  });

  it("returns RunPanelData for a real run, org-scoped", async () => {
    const run = await createRunsRepo(db).create(
      { orgId, userId: "system", role: "owner" },
      {
        skillId: "echo",
        mastraRunId: `mr-route-${crypto.randomUUID()}`,
      },
    );
    const res = await getRun(
      new Request(`http://localhost/api/runs/${run.id}`, { headers: ownerHeaders }),
      { params: Promise.resolve({ id: run.id }) },
    );
    const body = await res.json();
    expect(body.id).toBe(run.id);
    expect(body).toHaveProperty("conversation");
    expect(body).toHaveProperty("trace");
  });
});
