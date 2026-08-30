import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization, messages, runs, actions, auditLog } from "@agentos/core";
import { matchAndRun } from "../lib/router";
import { decideAction, retryAction } from "../lib/approve";

describe("retryAction", () => {
  let orgId: string;
  const ctx = () => ({ orgId, userId: "operator@example.com", role: "owner" });

  beforeAll(async () => {
    const [org] = await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Retry Test Org", slug: "retry-test-org", createdAt: new Date() })
      .returning();
    orgId = org.id;
  });
  afterEach(async () => {
    await db.delete(auditLog); await db.delete(actions); await db.delete(runs); await db.delete(messages);
  });
  afterAll(async () => { await db.delete(organization).where(eq(organization.id, orgId)); });

  it("re-attempts a failed action and succeeds once the underlying problem is fixed", async () => {
    const { actionId } = await matchAndRun({
      from: "customer@example.com", to: "ops@example.com", subject: "Hi", body: "Hello there", providerMessageId: "p-retry-1",
    });
    const [action] = await db.select().from(actions).where(eq(actions.id, actionId));
    const [run] = await db.select().from(runs).where(eq(runs.id, action.runId));
    const realMastraRunId = run.mastraRunId;

    await db.update(runs).set({ mastraRunId: "does-not-exist-yet" }).where(eq(runs.id, run.id));
    await expect(decideAction(ctx(), actionId, "approved")).rejects.toThrow(/execution failed/i);

    const [failedAction] = await db.select().from(actions).where(eq(actions.id, actionId));
    expect(failedAction.status).toBe("failed");

    // "Fix" the underlying problem the way an operator's retry click would
    // find it already fixed in a real incident (e.g. a transient DB blip).
    await db.update(runs).set({ mastraRunId: realMastraRunId }).where(eq(runs.id, run.id));

    const retried = await retryAction(ctx(), actionId);
    expect(retried.status).toBe("done");

    const [entry] = (await db.select().from(auditLog).where(eq(auditLog.entityId, actionId)))
      .filter((candidate) => candidate.event === "action.executed");
    expect(entry.event).toBe("action.executed");
    expect(entry.payload).toMatchObject({ trigger: "retried" });

    const [doneAction] = await db.select().from(actions).where(eq(actions.id, actionId));
    expect(doneAction.status).toBe("done");
  });

  it("refuses to retry an action that isn't failed", async () => {
    const { actionId } = await matchAndRun({
      from: "customer2@example.com", to: "ops@example.com", subject: "Hi", body: "Still pending", providerMessageId: "p-retry-2",
    });
    await expect(retryAction(ctx(), actionId)).rejects.toThrow(/not.*retryable/i);
  });

  it("retrying an action whose underlying Mastra run already completed fails fast, not silently or by duplicating", async () => {
    // adversarial-plan-review round 1, finding 1 (and LCD1/LCD9): the prior
    // test only proved recovery from a resume() that never touched the real
    // run. This proves the *other* case — resume() called on a run that IS
    // already terminal (confirmed via context7: resume() only claims a run
    // by transitioning its stored status from suspended to running). Models
    // the crash window LCD9 names: Mastra completed the run, but the action
    // row's own bookkeeping never caught up to "done".
    const { actionId } = await matchAndRun({
      from: "customer3@example.com", to: "ops@example.com", subject: "Hi", body: "Third message", providerMessageId: "p-retry-3",
    });
    await decideAction(ctx(), actionId, "approved");
    const [doneAction] = await db.select().from(actions).where(eq(actions.id, actionId));
    expect(doneAction.status).toBe("done");

    await db.update(actions).set({ status: "failed" }).where(eq(actions.id, actionId));

    await expect(retryAction(ctx(), actionId)).rejects.toThrow(/execution failed/i);

    const [refailed] = await db.select().from(actions).where(eq(actions.id, actionId));
    expect(refailed.status).toBe("failed"); // stayed failed, not silently "done" twice — no duplicate send
  });

  it("reclaims a stranded executing row once it is stale (LCD10)", async () => {
    // adversarial-plan-review round 1, finding 15 (reclaim half, sustained
    // on judge review): a row can strand in "executing" if the process
    // crashes between transitionStatus's claim and resumeAndFinish's own
    // completion — retryAction previously only claimed "failed" -> "executing",
    // so a stranded "executing" row had no path back at all. Simulate the
    // strand directly (no real crash needed): force status="executing" with
    // an executingSince far in the past.
    const { actionId } = await matchAndRun({
      from: "customer4@example.com", to: "ops@example.com", subject: "Hi", body: "Fourth message", providerMessageId: "p-retry-4",
    });
    await db.update(actions).set({
      status: "executing", executingSince: new Date(Date.now() - 20 * 60 * 1000), // 20 min ago, past the 10-min window
    }).where(eq(actions.id, actionId));

    const retried = await retryAction(ctx(), actionId);
    expect(retried.status).toBe("done");

    const [doneAction] = await db.select().from(actions).where(eq(actions.id, actionId));
    expect(doneAction.status).toBe("done");
  });

  it("refuses to reclaim an executing row that is still fresh, not stale", async () => {
    // The other half of LCD10: a row genuinely mid-flight (a concurrent
    // retry click, or a resumeAndFinish call still in progress) must NOT be
    // reclaimable — that would let two concurrent attempts both send.
    const { actionId } = await matchAndRun({
      from: "customer5@example.com", to: "ops@example.com", subject: "Hi", body: "Fifth message", providerMessageId: "p-retry-5",
    });
    await db.update(actions).set({
      status: "executing", executingSince: new Date(), // just claimed — well inside the 10-min window
    }).where(eq(actions.id, actionId));

    await expect(retryAction(ctx(), actionId)).rejects.toThrow(/not.*retryable/i);

    const [stillExecuting] = await db.select().from(actions).where(eq(actions.id, actionId));
    expect(stillExecuting.status).toBe("executing"); // untouched, not reclaimed
  });
});
