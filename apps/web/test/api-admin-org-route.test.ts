import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization as organizationTable, member } from "@agentos/core";
import { auth } from "../lib/auth";
import { GET as getOrg, PATCH as patchOrg } from "../app/api/admin/org/route";

// Adversarial review round 1, finding 15 (widened by author verification —
// see api-documents-route.test.ts above for the full citation): real
// user/org/member setup, not the fabricated better-auth test API.
describe("/api/admin/org", () => {
  let orgId: string, ownerId: string, operatorId: string;
  let ownerHeaders: Headers;
  let operatorHeaders: Headers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const test = ctx.test;
    const owner = test.createUser({ email: "admin-org-owner@example.com" });
    await test.saveUser(owner);
    ownerId = owner.id;
    const org = await auth.api.createOrganization({ body: { name: "Original Org Name", slug: `admin-org-${crypto.randomUUID()}`, userId: ownerId } });
    orgId = org!.id;
    ownerHeaders = await test.getAuthHeaders({ userId: ownerId });

    const operator = test.createUser({ email: "admin-org-operator@example.com" });
    await test.saveUser(operator);
    operatorId = operator.id;
    await auth.api.addMember({ body: { organizationId: orgId, userId: operatorId, role: "operator" } });
    operatorHeaders = await test.getAuthHeaders({ userId: operatorId });
  });

  afterAll(async () => {
    await db.delete(member).where(eq(member.organizationId, orgId));
    await db.delete(organizationTable).where(eq(organizationTable.id, orgId));
    await (await auth.$context).test.deleteUser(ownerId);
    await (await auth.$context).test.deleteUser(operatorId);
  });

  it("lets an owner read and update org name and locale", async () => {
    const before = await getOrg(new Request("http://localhost/api/admin/org", { headers: ownerHeaders }));
    expect((await before.json()).name).toBe("Original Org Name");

    const patchRes = await patchOrg(new Request("http://localhost/api/admin/org", {
      method: "PATCH", headers: ownerHeaders, body: JSON.stringify({ name: "Renamed Org", locale: "zh-TW" }),
    }));
    expect(patchRes.status).toBe(200);

    const after = await getOrg(new Request("http://localhost/api/admin/org", { headers: ownerHeaders }));
    const body = await after.json();
    expect(body.name).toBe("Renamed Org");
    expect(body.locale).toBe("zh-TW");
  });

  it("403s a non-admin on both GET and PATCH", async () => {
    const getRes = await getOrg(new Request("http://localhost/api/admin/org", { headers: operatorHeaders }));
    expect(getRes.status).toBe(403);
    const patchRes = await patchOrg(new Request("http://localhost/api/admin/org", {
      method: "PATCH", headers: operatorHeaders, body: JSON.stringify({ name: "Hijack" }),
    }));
    expect(patchRes.status).toBe(403);
  });

  it("reports channel state from real env-key presence, never the value (adversarial review round 1, finding 5)", async () => {
    const originalEmailKey = process.env.EMAIL_API_KEY;
    delete process.env.EMAIL_API_KEY;
    process.env.LINE_CHANNEL_ACCESS_TOKEN = "secret-token";
    try {
      const res = await getOrg(new Request("http://localhost/api/admin/org", { headers: ownerHeaders }));
      const body = await res.json();
      expect(body.channels).toEqual({ email: false, line: true });
      expect(JSON.stringify(body)).not.toContain("secret-token");
    } finally {
      if (originalEmailKey === undefined) delete process.env.EMAIL_API_KEY; else process.env.EMAIL_API_KEY = originalEmailKey;
      delete process.env.LINE_CHANNEL_ACCESS_TOKEN;
    }
  });
});
