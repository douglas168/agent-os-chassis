import { describe, it, expect, beforeAll, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { db, organizations, messages, runs, actions, auditLog } from "@agentos/core";
import { matchAndRun } from "../lib/router";
import { decideAction } from "../lib/approve";

describe("decideAction", () => {
  beforeAll(async () => { await db.insert(organizations).values({ name: "Approve Test Org" }); });
  afterEach(async () => {
    await db.delete(auditLog); await db.delete(actions); await db.delete(runs); await db.delete(messages);
  });

  it("approving a pending action resumes the workflow, executes, and writes an audit entry", async () => {
    const { actionId } = await matchAndRun({
      from: "customer@example.com", to: "ops@example.com",
      subject: "Hi", body: "Hello there", providerMessageId: "p-approve-1",
    });

    const result = await decideAction(actionId, "approved", "operator@example.com");

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

    await decideAction(actionId, "denied", "operator@example.com");

    const [action] = await db.select().from(actions).where(eq(actions.id, actionId));
    expect(action.status).toBe("denied");
  });
});
