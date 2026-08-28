import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization, messages, runs, actions, auditLog } from "@agentos/core";
import { matchAndRun } from "../lib/router";
import { decideAction } from "../lib/approve";

describe("decideAction", () => {
  let orgId: string;

  beforeAll(async () => {
    const [org] = await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Approve Test Org", slug: "approve-test-org", createdAt: new Date() })
      .returning();
    orgId = org.id;
  });
  afterEach(async () => {
    await db.delete(auditLog); await db.delete(actions); await db.delete(runs); await db.delete(messages);
  });

  afterAll(async () => {
    await db.delete(organization);
  });

  it("approving a pending action resumes the workflow, executes, and writes an audit entry", async () => {
    const { actionId } = await matchAndRun({
      from: "customer@example.com", to: "ops@example.com",
      subject: "Hi", body: "Hello there", providerMessageId: "p-approve-1",
    });

    const ctx = { orgId, userId: "operator@example.com", role: "owner" };
    const result = await decideAction(ctx, actionId, "approved");

    expect(result.status).toBe("done");
    const [action] = await db.select().from(actions).where(eq(actions.id, actionId));
    expect(action.status).toBe("done");
    const [entry] = await db.select().from(auditLog);
    expect(entry.event).toBe("action.approved");
  });

  it("denying a pending action resumes the workflow without sending, and leaves status denied", async () => {
    const { actionId } = await matchAndRun({
      from: "customer2@example.com", to: "ops@example.com",
      subject: "Hi", body: "Another message", providerMessageId: "p-approve-2",
    });

    const ctx = { orgId, userId: "operator@example.com", role: "owner" };
    await decideAction(ctx, actionId, "denied");

    const [action] = await db.select().from(actions).where(eq(actions.id, actionId));
    expect(action.status).toBe("denied");
  });
});
