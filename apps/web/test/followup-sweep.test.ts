import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization, messages, runs, actions, followUps, orgSkillConfig, createFollowUpsRepo, createOrgSkillConfigRepo } from "@agentos/core";
import { matchAndRun } from "../lib/router";
import { sweepFollowUps } from "../lib/followup-sweep";

describe("sweepFollowUps", () => {
  let orgId: string;

  beforeAll(async () => {
    const [org] = await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Followup Sweep Test Org", slug: "followup-sweep-test-org", createdAt: new Date() })
      .returning();
    orgId = org.id;
  });
  afterEach(async () => {
    await db.delete(followUps); await db.delete(actions); await db.delete(runs); await db.delete(messages);
  });
  afterAll(async () => {
    await db.delete(orgSkillConfig).where(eq(orgSkillConfig.orgId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
  });

  it("drafts a new pending action from a due follow-up and marks it done", async () => {
    const origin = await matchAndRun({
      from: "customer@example.com", to: "ops@example.com",
      subject: "Hi", body: "Original message", providerMessageId: "p-sweep-1",
    });
    const followUpsRepo = createFollowUpsRepo(db);
    const ctx = { orgId, userId: "system", role: "owner" };
    const scheduled = await followUpsRepo.schedule(ctx, {
      actionId: origin.actionId, skillId: "echo", dueAt: new Date(Date.now() - 1000), touchIndex: 1,
    });

    const swept = await sweepFollowUps();
    expect(swept.drafted).toBe(1);

    const pendingActions = await db.select().from(actions).where(eq(actions.status, "pending"));
    // origin's own action was already executed by matchAndRun's workflow start
    // (echo auto-approves nothing — it suspends pending, so origin's action IS
    // still pending too); the sweep must have created a second, distinct one.
    expect(pendingActions.length).toBe(2);

    const [followUpRow] = await db.select().from(followUps).where(eq(followUps.id, scheduled.id));
    expect(followUpRow.status).toBe("done");
  });

  it("is idempotent if the sweep runs twice on a row already marked done", async () => {
    const origin = await matchAndRun({
      from: "customer2@example.com", to: "ops@example.com",
      subject: "Hi", body: "Another message", providerMessageId: "p-sweep-2",
    });
    const followUpsRepo = createFollowUpsRepo(db);
    const ctx = { orgId, userId: "system", role: "owner" };
    await followUpsRepo.schedule(ctx, {
      actionId: origin.actionId, skillId: "echo", dueAt: new Date(Date.now() - 1000), touchIndex: 1,
    });

    const first = await sweepFollowUps();
    const second = await sweepFollowUps();
    expect(first.drafted).toBe(1);
    expect(second.drafted).toBe(0);
  });

  it("a row whose processing throws reverts to scheduled instead of being lost", async () => {
    // followUps.actionId is a NOT NULL FK to actions.id (shipped Task 4) — a
    // nonexistent actionId is rejected at insert time and never reaches the
    // sweep at all, so the throw path must be reached via a REAL action whose
    // run has no messageId (runs.messageId is nullable): the sweep's origin
    // lookup succeeds, but its "origin run/message not found" throw fires.
    const [orphanRun] = await db.insert(runs)
      .values({ id: crypto.randomUUID(), orgId, skillId: "echo", mastraRunId: `mr-orphan-${crypto.randomUUID()}`, status: "done" })
      .returning();
    const [orphanAction] = await db.insert(actions).values({
      id: crypto.randomUUID(), orgId, runId: orphanRun.id, skillId: "echo", kind: "reply",
      draft: {}, idempotencyKey: `${orphanRun.id}:draft`, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 72),
    }).returning();
    await db.insert(followUps).values({
      id: crypto.randomUUID(), orgId, actionId: orphanAction.id, skillId: "echo",
      dueAt: new Date(Date.now() - 1000), status: "scheduled", touchIndex: 3,
    });

    const swept = await sweepFollowUps();
    expect(swept.drafted).toBe(0);

    const [row] = await db.select().from(followUps).where(eq(followUps.actionId, orphanAction.id));
    expect(row.status).toBe("scheduled"); // not stranded as a false "done"
    expect(row.attempts).toBe(1);
  });

  it("dead-letters to failed after MAX_FOLLOWUP_ATTEMPTS consecutive failures", async () => {
    // New judge-found defect (adversarial-plan-review round 1): the revert
    // path above retried a permanently-broken row forever. Same orphaned-run
    // trigger as the previous test (see its comment re: the actionId FK), run
    // through the sweep 3 times running the row's attempts counter to the cap.
    const [orphanRun] = await db.insert(runs)
      .values({ id: crypto.randomUUID(), orgId, skillId: "echo", mastraRunId: `mr-orphan-${crypto.randomUUID()}`, status: "done" })
      .returning();
    const [orphanAction] = await db.insert(actions).values({
      id: crypto.randomUUID(), orgId, runId: orphanRun.id, skillId: "echo", kind: "reply",
      draft: {}, idempotencyKey: `${orphanRun.id}:draft`, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 72),
    }).returning();
    await db.insert(followUps).values({
      id: crypto.randomUUID(), orgId, actionId: orphanAction.id, skillId: "echo",
      dueAt: new Date(Date.now() - 1000), status: "scheduled", touchIndex: 4,
    });

    await sweepFollowUps();
    await sweepFollowUps();
    const third = await sweepFollowUps();
    expect(third.drafted).toBe(0);

    const [row] = await db.select().from(followUps).where(eq(followUps.actionId, orphanAction.id));
    expect(row.status).toBe("failed");
    expect(row.attempts).toBe(3);
  });

  it("resolves the source message via action -> run -> message, not by guessing from draft.to", async () => {
    // Two customers share the same reply-to address on purpose: draft.to
    // address-matching (the bug this fix replaces) would pick whichever one
    // Array.find() hits first, which can be the wrong conversation.
    const shared = "shared@example.com";
    const origin = await matchAndRun({
      from: shared, to: "ops@example.com", subject: "First", body: "First conversation", providerMessageId: "p-sweep-join-1",
    });
    await matchAndRun({
      from: shared, to: "ops@example.com", subject: "Second", body: "Second, unrelated conversation", providerMessageId: "p-sweep-join-2",
    });

    const followUpsRepo = createFollowUpsRepo(db);
    const ctx = { orgId, userId: "system", role: "owner" };
    await followUpsRepo.schedule(ctx, {
      actionId: origin.actionId, skillId: "echo", dueAt: new Date(Date.now() - 1000), touchIndex: 1,
    });

    const swept = await sweepFollowUps();
    expect(swept.drafted).toBe(1);

    const [originAction] = await db.select().from(actions).where(eq(actions.id, origin.actionId));
    const [originRun] = await db.select().from(runs).where(eq(runs.id, originAction.runId));
    const drafted = await db.select().from(actions).where(eq(actions.runId, originRun.id));
    // The follow-up's own draft must be a reply to the FIRST conversation's
    // body, not whichever same-address message address-matching happened to
    // find first.
    const followUpAction = (await db.select().from(actions))
      .find((a) => a.id !== origin.actionId && (a.draft as any)?.body?.includes("First conversation"));
    expect(followUpAction).toBeDefined();
  });

  it("a due follow-up for a disabled skill is claimed but never drafted", async () => {
    const origin = await matchAndRun({
      from: "customer3@example.com",
      to: "ops@example.com",
      subject: "Hi",
      body: "Third message",
      providerMessageId: "p-sweep-disabled-1",
    });
    const followUpsRepo = createFollowUpsRepo(db);
    const ctx = { orgId, userId: "system", role: "owner" };
    await followUpsRepo.schedule(ctx, {
      actionId: origin.actionId,
      skillId: "echo",
      dueAt: new Date(Date.now() - 1000),
      touchIndex: 1,
    });
    await createOrgSkillConfigRepo(db).upsert(ctx, "echo", { enabled: false, config: {} });

    const swept = await sweepFollowUps();
    expect(swept.drafted).toBe(0);

    const [followUpRow] = await db.select().from(followUps).where(eq(followUps.actionId, origin.actionId));
    expect(followUpRow.status).toBe("done");
  });
});
