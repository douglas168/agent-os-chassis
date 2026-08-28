import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization, messages, runs, actions } from "@agentos/core";
import { matchAndRun } from "../lib/router";

describe("matchAndRun", () => {
  beforeAll(async () => {
    await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Router Test Org", slug: "router-test-org", createdAt: new Date() });
  });

  afterEach(async () => {
    await db.delete(actions);
    await db.delete(runs);
    await db.delete(messages);
  });

  afterAll(async () => {
    await db.delete(organization);
  });

  it("matches the echo skill, creates a suspended run, and a pending action with the draft", async () => {
    const result = await matchAndRun({
      from: "customer@example.com", to: "ops@example.com",
      subject: "Hi", body: "Hello there", providerMessageId: "p-router-1",
    });

    expect(result.matched).toBe(true);

    const [run] = await db.select().from(runs).where(eq(runs.mastraRunId, result.runId));
    expect(run.status).toBe("suspended");
    expect(run.skillId).toBe("echo");

    const [action] = await db.select().from(actions).where(eq(actions.id, result.actionId));
    expect(action.status).toBe("pending");
    expect(action.draft).toEqual({
      kind: "reply", to: "customer@example.com", subject: "Re: Hi", body: "You said: Hello there",
    });
  });
});
