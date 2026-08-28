import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { db, organization, messages, runs, actions } from "@agentos/core";
import { POST } from "../app/api/webhooks/mock/route";

describe("POST /api/webhooks/mock", () => {
  beforeAll(async () => {
    await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Webhook Test Org", slug: "webhook-test-org", createdAt: new Date() });
  });
  afterEach(async () => { await db.delete(actions); await db.delete(runs); await db.delete(messages); });
  afterAll(async () => { await db.delete(organization); });

  it("ingests a payload and returns matched: true", async () => {
    const req = new Request("http://localhost/api/webhooks/mock", {
      method: "POST",
      body: JSON.stringify({
        from: "customer@example.com", to: "ops@example.com",
        subject: "Hi", body: "Hello there", providerMessageId: "p-webhook-1",
      }),
    });
    const res = await POST(req);
    const json = await res.json();
    expect(json.matched).toBe(true);
  });
});
