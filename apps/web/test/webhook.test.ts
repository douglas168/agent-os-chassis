import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { db, organizations, messages, runs } from "@agentos/core";
import { POST } from "../app/api/webhooks/mock/route";

describe("POST /api/webhooks/mock", () => {
  beforeAll(async () => { await db.insert(organizations).values({ name: "Webhook Test Org" }); });
  afterEach(async () => { await db.delete(runs); await db.delete(messages); });

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
