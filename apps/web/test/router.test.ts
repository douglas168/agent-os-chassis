import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization, messages, runs, actions, contacts, followUps, createFollowUpsRepo } from "@agentos/core";
import { matchAndRun } from "../lib/router";

describe("matchAndRun", () => {
  beforeAll(async () => {
    await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Router Test Org", slug: "router-test-org", createdAt: new Date() });
  });

  afterEach(async () => {
    await db.delete(followUps);
    await db.delete(actions);
    await db.delete(runs);
    await db.delete(messages);
    await db.delete(contacts);
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

  it("cancels a contact's scheduled follow-ups when they reply", async () => {
    const [contact] = await db.insert(contacts).values({
      id: crypto.randomUUID(), orgId: (await db.select().from(organization))[0].id,
      name: "Repeat Customer", emails: ["repeat@example.com"],
    }).returning();

    const first = await matchAndRun({
      from: "repeat@example.com", to: "ops@example.com", subject: "Hi", body: "First message", providerMessageId: "p-cancel-1",
    });
    const followUpsRepo = createFollowUpsRepo(db);
    await followUpsRepo.schedule(
      { orgId: contact.orgId, userId: "system", role: "owner" },
      { actionId: first.actionId, skillId: "echo", dueAt: new Date(Date.now() + 1000 * 60 * 60 * 24 * 3), touchIndex: 1 },
    );

    await matchAndRun({
      from: "repeat@example.com", to: "ops@example.com", subject: "Re: Hi", body: "Second message", providerMessageId: "p-cancel-2",
    });

    const [followUp] = await db.select().from(followUps).where(eq(followUps.actionId, first.actionId));
    expect(followUp.status).toBe("cancelled");
  });
});
