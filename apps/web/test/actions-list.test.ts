import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { db, organizations, messages, runs, actions } from "@agentos/core";
import { matchAndRun } from "../lib/router";
import { GET } from "../app/api/actions/route";

describe("GET /api/actions", () => {
  beforeAll(async () => { await db.insert(organizations).values({ name: "Actions List Test Org" }); });
  afterEach(async () => {
    await db.delete(actions); await db.delete(runs); await db.delete(messages);
  });

  it("lists pending actions for the current org", async () => {
    await matchAndRun({
      from: "customer@example.com", to: "ops@example.com",
      subject: "Hi", body: "Hello there", providerMessageId: "p-list-1",
    });

    const res = await GET();
    const json = await res.json();
    expect(json).toHaveLength(1);
    expect(json[0].status).toBe("pending");
  });
});
