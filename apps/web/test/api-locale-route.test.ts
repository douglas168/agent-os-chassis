import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, user, organization, member } from "@agentos/core";
import { PATCH } from "../app/api/locale/route";
import { auth } from "../lib/auth";

describe("PATCH /api/locale", () => {
  let orgId: string, userId: string;

  beforeAll(async () => {
    const ctx2 = await auth.$context;
    const test = ctx2.test;
    const created = test.createUser({ email: "locale-route-user@example.com" });
    await test.saveUser(created);
    userId = created.id;
    const org = await auth.api.createOrganization({ body: { name: "Locale Route Org", slug: "locale-route-org", userId } });
    orgId = org!.id;
  });

  afterAll(async () => {
    await db.delete(member).where(eq(member.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
    const ctx2 = await auth.$context;
    await ctx2.test.deleteUser(userId);
  });

  it("persists the caller's locale on the user row", async () => {
    const headers = await (await auth.$context).test.getAuthHeaders({ userId });
    const req = new Request("http://localhost:3000/api/locale", {
      method: "PATCH", headers, body: JSON.stringify({ locale: "zh-TW" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ locale: "zh-TW" });

    const [row] = await db.select({ locale: user.locale }).from(user).where(eq(user.id, userId));
    expect(row.locale).toBe("zh-TW");
  });

  it("rejects an unsupported locale with 400", async () => {
    const headers = await (await auth.$context).test.getAuthHeaders({ userId });
    const req = new Request("http://localhost:3000/api/locale", {
      method: "PATCH", headers, body: JSON.stringify({ locale: "fr" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(400);
  });

  it("returns 401 with no session", async () => {
    const req = new Request("http://localhost:3000/api/locale", {
      method: "PATCH", body: JSON.stringify({ locale: "en" }),
    });
    const res = await PATCH(req);
    expect(res.status).toBe(401);
  });

  it("surfaces the persisted locale on session.user (Better-Auth additionalFields, finding 4)", async () => {
    const headers = await (await auth.$context).test.getAuthHeaders({ userId });
    await PATCH(new Request("http://localhost:3000/api/locale", {
      method: "PATCH", headers, body: JSON.stringify({ locale: "zh-TW" }),
    }));
    const session = await auth.api.getSession({ headers });
    expect(session?.user.locale).toBe("zh-TW");
  });
});
