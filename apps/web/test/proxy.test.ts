import { describe, it, expect, afterAll } from "vitest";
import { NextRequest } from "next/server";
import { auth } from "../lib/auth";
import { proxy } from "../proxy";

describe("proxy", () => {
  let createdUserId: string | undefined;

  afterAll(async () => {
    if (createdUserId) {
      const ctx = await auth.$context;
      await ctx.test.deleteUser(createdUserId);
    }
  });

  it("blocks /approvals with no session", async () => {
    const req = new NextRequest("http://localhost:3000/approvals");
    const res = await proxy(req);
    expect(res.status).toBe(401);
  });

  it("blocks /api/actions with no session", async () => {
    const req = new NextRequest("http://localhost:3000/api/actions");
    const res = await proxy(req);
    expect(res.status).toBe(401);
  });

  it("allows /approvals with a valid session", async () => {
    const ctx = await auth.$context;
    const test = ctx.test;
    const user = test.createUser({ email: "proxy-user@example.com" });
    await test.saveUser(user);
    createdUserId = user.id;
    const headers = await test.getAuthHeaders({ userId: user.id });

    const req = new NextRequest("http://localhost:3000/approvals", { headers });
    const res = await proxy(req);
    expect(res.status).not.toBe(401);
  });
});
