import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization, messages, runs, actions, auditLog } from "@agentos/core";
import { matchAndRun } from "../lib/router";
import { sweepExpiredActions } from "../lib/expiry";

describe("sweepExpiredActions", () => {
  let orgId: string;

  beforeAll(async () => {
    const [org] = await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Expiry Test Org", slug: "expiry-test-org", createdAt: new Date() })
      .returning();
    orgId = org.id;
  });
  afterEach(async () => {
    await db.delete(auditLog); await db.delete(actions); await db.delete(runs); await db.delete(messages);
  });
  afterAll(async () => { await db.delete(organization).where(eq(organization.id, orgId)); });

  it("flips a pending action past its expires_at to expired, and writes an audit entry", async () => {
    const { actionId } = await matchAndRun({
      from: "customer@example.com", to: "ops@example.com",
      subject: "Hi", body: "Hello there", providerMessageId: "p-expiry-1",
    });
    // Force it into the past — matchAndRun always sets a real 72h-out expiry.
    await db.update(actions).set({ expiresAt: new Date(Date.now() - 1000) }).where(eq(actions.id, actionId));

    const swept = await sweepExpiredActions();
    expect(swept.expired).toBe(1);

    const [action] = await db.select().from(actions).where(eq(actions.id, actionId));
    expect(action.status).toBe("expired");

    const [entry] = await db.select().from(auditLog).where(eq(auditLog.entityId, actionId));
    expect(entry.event).toBe("action.expired");
  });

  it("never touches a pending action that hasn't expired yet", async () => {
    const { actionId } = await matchAndRun({
      from: "customer2@example.com", to: "ops@example.com",
      subject: "Hi", body: "Not due yet", providerMessageId: "p-expiry-2",
    });

    await sweepExpiredActions();

    const [action] = await db.select().from(actions).where(eq(actions.id, actionId));
    expect(action.status).toBe("pending");
  });
});
