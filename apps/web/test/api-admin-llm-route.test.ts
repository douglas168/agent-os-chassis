import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization, member } from "@agentos/core";
import { auth } from "../lib/auth";
import { GET as getLlmConfig } from "../app/api/admin/llm/route";
import { POST as testConnection } from "../app/api/admin/llm/test-connection/route";

// Adversarial review round 1, finding 15 (widened by author verification —
// see api-documents-route.test.ts above for the full citation): real
// user/org/member setup, not the fabricated better-auth test API.
describe("/api/admin/llm", () => {
  let orgId: string, ownerId: string, operatorId: string;
  let ownerHeaders: Headers;
  let operatorHeaders: Headers;
  const originalEnv = { ...process.env };

  beforeAll(async () => {
    process.env.LLM_BASE_URL = "http://localhost:11434/v1";
    process.env.LLM_API_KEY = "ollama";
    process.env.LLM_MODEL = "qwen2.5:7b";

    const ctx = await auth.$context;
    const test = ctx.test;
    const owner = test.createUser({ email: "admin-llm-owner@example.com" });
    await test.saveUser(owner);
    ownerId = owner.id;
    const org = await auth.api.createOrganization({ body: { name: "LLM Org", slug: `llm-org-${crypto.randomUUID()}`, userId: ownerId } });
    orgId = org!.id;
    ownerHeaders = await test.getAuthHeaders({ userId: ownerId });

    const operator = test.createUser({ email: "admin-llm-operator@example.com" });
    await test.saveUser(operator);
    operatorId = operator.id;
    await auth.api.addMember({ body: { organizationId: orgId, userId: operatorId, role: "operator" } });
    operatorHeaders = await test.getAuthHeaders({ userId: operatorId });
  });

  afterAll(async () => {
    await db.delete(member).where(eq(member.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
    await (await auth.$context).test.deleteUser(ownerId);
    await (await auth.$context).test.deleteUser(operatorId);
    process.env = originalEnv;
  });

  it("shows baseUrl/model but never the key value, and 403s a non-admin", async () => {
    const res = await getLlmConfig(new Request("http://localhost/api/admin/llm", { headers: ownerHeaders }));
    const body = await res.json();
    expect(body.baseUrl).toBe("http://localhost:11434/v1");
    expect(body.model).toBe("qwen2.5:7b");
    expect(body.apiKeyConfigured).toBe(true);
    expect(JSON.stringify(body)).not.toContain("ollama");

    const forbidden = await getLlmConfig(new Request("http://localhost/api/admin/llm", { headers: operatorHeaders }));
    expect(forbidden.status).toBe(403);
  });

  it("test-connection reports failure when the endpoint is unreachable", async () => {
    vi.stubGlobal("fetch", vi.fn(() => Promise.reject(new Error("ECONNREFUSED"))) as unknown as typeof fetch);
    const res = await testConnection(new Request("http://localhost/api/admin/llm/test-connection", { method: "POST", headers: ownerHeaders }));
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.detail).toContain("ECONNREFUSED");
    vi.unstubAllGlobals();
  });
});
