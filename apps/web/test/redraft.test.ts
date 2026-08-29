import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization, messages, runs, actions, auditLog } from "@agentos/core";
import { matchAndRun } from "../lib/router";
import { redraftAction } from "../lib/redraft";

describe("redraftAction", () => {
  let orgId: string;
  const ctx = () => ({ orgId, userId: "operator@example.com", role: "owner" });

  beforeAll(async () => {
    const [org] = await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Redraft Test Org", slug: "redraft-test-org", createdAt: new Date() })
      .returning();
    orgId = org.id;
  });
  afterEach(async () => {
    await db.delete(auditLog); await db.delete(actions); await db.delete(runs); await db.delete(messages);
  });
  afterAll(async () => { await db.delete(organization).where(eq(organization.id, orgId)); });

  it("starts a fresh run and action from an expired one, never resuming the old one", async () => {
    const first = await matchAndRun({
      from: "customer@example.com", to: "ops@example.com",
      subject: "Hi", body: "Hello there", providerMessageId: "p-redraft-1",
    });
    await db.update(actions).set({ status: "expired" }).where(eq(actions.id, first.actionId));

    const redrafted = await redraftAction(ctx(), first.actionId);
    expect(redrafted.actionId).not.toBe(first.actionId);
    expect(redrafted.runId).not.toBe(first.runId);

    const [newAction] = await db.select().from(actions).where(eq(actions.id, redrafted.actionId));
    expect(newAction.status).toBe("pending");
  });

  it("refuses to redraft an action that isn't expired", async () => {
    const { actionId } = await matchAndRun({
      from: "customer2@example.com", to: "ops@example.com",
      subject: "Hi", body: "Still pending", providerMessageId: "p-redraft-2",
    });
    await expect(redraftAction(ctx(), actionId)).rejects.toThrow(/not expired/i);
  });

  it("reports a missing originating message for an orphaned run", async () => {
    const { actionId } = await matchAndRun({
      from: "customer3@example.com", to: "ops@example.com",
      subject: "Hi", body: "Orphaned run", providerMessageId: "p-redraft-3",
    });
    await db.update(actions).set({ status: "expired" }).where(eq(actions.id, actionId));
    const [actionRow] = await db.select().from(actions).where(eq(actions.id, actionId));
    await db.update(runs).set({ messageId: null }).where(eq(runs.id, actionRow.runId));

    // This is the route's widened not-found pattern for "no originating message".
    await expect(redraftAction(ctx(), actionId)).rejects.toThrow(/no .*message/);
  });
});
