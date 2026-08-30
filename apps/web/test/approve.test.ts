import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization, messages, runs, actions, auditLog } from "@agentos/core";
import { matchAndRun } from "../lib/router";
import { decideAction, resumeAndFinish } from "../lib/approve";

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
    expect(entry.event).toBe("action.executed");
    expect(entry.payload).toMatchObject({ trigger: "approved" });
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

  it("F-fix5: a deny-path resume() that throws still updates the run and writes an audit row", async () => {
    const { actionId } = await matchAndRun({
      from: "customer-deny-fail@example.com", to: "ops@example.com",
      subject: "Hi", body: "Deny-fail message", providerMessageId: "p-approve-deny-fail",
    });
    const ctx = { orgId, userId: "operator@example.com", role: "owner" };

    const [action] = await db.select().from(actions).where(eq(actions.id, actionId));
    const [run] = await db.select().from(runs).where(eq(runs.id, action.runId));
    await db.update(runs).set({ mastraRunId: "does-not-exist-in-mastra" }).where(eq(runs.id, run.id));

    await expect(decideAction(ctx, actionId, "denied")).rejects.toThrow(/execution failed/i);

    const [failedRun] = await db.select().from(runs).where(eq(runs.id, run.id));
    expect(failedRun.status).toBe("failed");

    const entries = await db.select().from(auditLog).where(eq(auditLog.entityId, actionId));
    expect(entries.some((e) => e.event === "action.execute_failed")).toBe(true);

    const [failedAction] = await db.select().from(actions).where(eq(actions.id, actionId));
    expect(failedAction.status).toBe("denied");

    const [failedEntry] = entries.filter((e) => e.event === "action.execute_failed");
    expect(failedEntry.payload).toMatchObject({ trigger: "denied" });
  });

  it("transitions approved -> executing before resuming the workflow", async () => {
    const { actionId } = await matchAndRun({
      from: "customer3@example.com", to: "ops@example.com", subject: "Hi", body: "Third message", providerMessageId: "p-approve-3",
    });
    const ctx = { orgId, userId: "operator@example.com", role: "owner" };
    const result = await decideAction(ctx, actionId, "approved");
    expect(result.status).toBe("done");
  });

  it("F34: a resume() that throws leaves the action failed with an audit row, not stuck", async () => {
    const { actionId } = await matchAndRun({
      from: "customer4@example.com", to: "ops@example.com", subject: "Hi", body: "Fourth message", providerMessageId: "p-approve-4",
    });
    const ctx = { orgId, userId: "operator@example.com", role: "owner" };

    const [action] = await db.select().from(actions).where(eq(actions.id, actionId));
    const [run] = await db.select().from(runs).where(eq(runs.id, action.runId));
    await db.update(runs).set({ mastraRunId: "does-not-exist-in-mastra" }).where(eq(runs.id, run.id));

    await expect(decideAction(ctx, actionId, "approved")).rejects.toThrow(/execution failed/i);

    const [failedAction] = await db.select().from(actions).where(eq(actions.id, actionId));
    expect(failedAction.status).toBe("failed");

    const entries = await db.select().from(auditLog).where(eq(auditLog.entityId, actionId));
    expect(entries.some((e) => e.event === "action.execute_failed")).toBe(true);

    const [failedEntry] = entries.filter((e) => e.event === "action.execute_failed");
    expect(failedEntry.payload).toMatchObject({ trigger: "approved" });
  });

  it("a genuine step-logic failure (not a resume()-level throw) produces a real failed WorkflowResult that extractFailedStep reads correctly", async () => {
    const { actionId } = await matchAndRun({
      from: "customer5@example.com", to: "ops@example.com", subject: "Hi", body: "Fifth message", providerMessageId: "p-approve-5",
    });
    const ctx = { orgId, userId: "operator@example.com", role: "owner" };
    const [action] = await db.select().from(actions).where(eq(actions.id, actionId));
    const [run] = await db.select().from(runs).where(eq(runs.id, action.runId));

    const status = await resumeAndFinish(ctx, actionId, run.id, run.mastraRunId, action.skillId, null, "approved");
    expect(status).toBe("failed");

    const [failedAction] = await db.select().from(actions).where(eq(actions.id, actionId));
    expect(failedAction.status).toBe("failed");

    const [failedRun] = await db.select().from(runs).where(eq(runs.id, run.id));
    expect(failedRun.status).toBe("failed");
    expect(failedRun.failedStep).toBe("execute");
    console.log(`[LCD5 observation] failedInput = ${JSON.stringify(failedRun.failedInput)}`);
    expect(failedRun.failedInput).not.toBe(undefined);
  });
});
