import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { organization, runs, actions, messages, contacts, followUps, auditLog } from "../src/db/schema";
import { createFollowUpsRepo } from "../src/repositories/followups";

describe("follow-ups repository", () => {
  let orgId: string, actionId: string;

  beforeAll(async () => {
    const [org] = await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Followups Test Org", slug: "followups-test-org", createdAt: new Date() })
      .returning();
    orgId = org.id;
    const [run] = await db.insert(runs)
      .values({ id: crypto.randomUUID(), orgId, skillId: "echo", mastraRunId: "mr-fu-1", status: "done" })
      .returning();
    const [action] = await db.insert(actions).values({
      id: crypto.randomUUID(), orgId, runId: run.id, skillId: "echo", kind: "reply",
      draft: {}, idempotencyKey: `${run.id}:draft`, expiresAt: new Date(Date.now() + 1000 * 60 * 60 * 72),
    }).returning();
    actionId = action.id;
  });

  afterEach(async () => {
    await db.delete(auditLog).where(eq(auditLog.orgId, orgId));
    await db.delete(followUps).where(eq(followUps.orgId, orgId));
  });
  afterAll(async () => {
    await db.delete(auditLog).where(eq(auditLog.orgId, orgId));
    await db.delete(followUps).where(eq(followUps.orgId, orgId));
    await db.delete(actions).where(eq(actions.orgId, orgId));
    await db.delete(runs).where(eq(runs.orgId, orgId));
    await db.delete(messages).where(eq(messages.orgId, orgId));
    await db.delete(contacts).where(eq(contacts.orgId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
  });

  it("schedules a follow-up, and is idempotent on (action_id, touch_index) on reschedule", async () => {
    const followUpsRepo = createFollowUpsRepo(db);
    const ctx = { orgId, userId: "system", role: "owner" };

    await followUpsRepo.schedule(ctx, { actionId, skillId: "echo", dueAt: new Date(), touchIndex: 0 });
    await followUpsRepo.schedule(ctx, { actionId, skillId: "echo", dueAt: new Date(), touchIndex: 0 });

    const rows = await db.select().from(followUps).where(eq(followUps.actionId, actionId));
    expect(rows).toHaveLength(1);
  });

  it("lists due rows across orgs, and cancelling a contact's scheduled follow-ups leaves the rest alone", async () => {
    const followUpsRepo = createFollowUpsRepo(db);
    const ctx = { orgId, userId: "system", role: "owner" };
    const contactId = crypto.randomUUID();

    await followUpsRepo.schedule(ctx, { actionId, skillId: "echo", dueAt: new Date(Date.now() - 1000), touchIndex: 1 });
    await followUpsRepo.schedule(ctx, { actionId, skillId: "echo", dueAt: new Date(Date.now() + 1000 * 60 * 60), touchIndex: 2 });

    const due = await followUpsRepo.listDue();
    expect(due.some((r) => r.actionId === actionId && r.touchIndex === 1)).toBe(true);
    expect(due.some((r) => r.actionId === actionId && r.touchIndex === 2)).toBe(false);

    await followUpsRepo.cancelScheduledForContact(ctx, contactId, "cancel_on_reply");
    // No follow-up was scheduled against this contactId (schedule() here isn't
    // contact-keyed — it's action-keyed); this proves the call is a no-op
    // rather than throwing when nothing matches.
    const stillScheduled = await db.select().from(followUps).where(eq(followUps.status, "scheduled"));
    expect(stillScheduled).toHaveLength(2);
  });

  it("excludeSkillIds keeps an opted-out skill's follow-ups scheduled while cancelling every other skill's", async () => {
    const [contact] = await db.insert(contacts).values({
      id: crypto.randomUUID(), orgId, name: "Exclude Skill Contact", emails: ["exclude@example.com"],
    }).returning();
    const followUpsRepo = createFollowUpsRepo(db);
    const ctx = { orgId, userId: "system", role: "system" };

    const [messageA] = await db.insert(messages).values({
      id: crypto.randomUUID(), orgId, channel: "mock", direction: "in", providerMessageId: "p-exclude-a",
      from: "exclude@example.com", to: "ops@example.com", body: "hi", contactId: contact.id,
    }).returning();
    const [runA] = await db.insert(runs).values({ id: crypto.randomUUID(), orgId, skillId: "skill-a", messageId: messageA.id, mastraRunId: "mr-exclude-a" }).returning();
    const [actionA] = await db.insert(actions).values({
      id: crypto.randomUUID(), orgId, runId: runA.id, skillId: "skill-a", kind: "reply", draft: {},
      idempotencyKey: "exclude-a", expiresAt: new Date(Date.now() + 3600_000),
    }).returning();
    await followUpsRepo.schedule(ctx, { actionId: actionA.id, skillId: "skill-a", dueAt: new Date(Date.now() + 86_400_000), touchIndex: 0 });

    const [messageB] = await db.insert(messages).values({
      id: crypto.randomUUID(), orgId, channel: "mock", direction: "in", providerMessageId: "p-exclude-b",
      from: "exclude@example.com", to: "ops@example.com", body: "hi", contactId: contact.id,
    }).returning();
    const [runB] = await db.insert(runs).values({ id: crypto.randomUUID(), orgId, skillId: "skill-b", messageId: messageB.id, mastraRunId: "mr-exclude-b" }).returning();
    const [actionB] = await db.insert(actions).values({
      id: crypto.randomUUID(), orgId, runId: runB.id, skillId: "skill-b", kind: "reply", draft: {},
      idempotencyKey: "exclude-b", expiresAt: new Date(Date.now() + 3600_000),
    }).returning();
    await followUpsRepo.schedule(ctx, { actionId: actionB.id, skillId: "skill-b", dueAt: new Date(Date.now() + 86_400_000), touchIndex: 0 });

    const result = await followUpsRepo.cancelScheduledForContact(ctx, contact.id, "cancel_on_reply", ["skill-b"]);
    expect(result.cancelled).toBe(1);

    const [rowA] = await db.select().from(followUps).where(eq(followUps.actionId, actionA.id));
    expect(rowA.status).toBe("cancelled");
    const [rowB] = await db.select().from(followUps).where(eq(followUps.actionId, actionB.id));
    expect(rowB.status).toBe("scheduled");

    // finding 10 (adversarial review round 1): the cancellation reason was
    // computed and returned but never persisted — one audit entry per batch.
    const auditRows = await db.select().from(auditLog).where(eq(auditLog.entityId, contact.id));
    const cancelEvents = auditRows.filter((e) => e.event === "followups.cancelled");
    expect(cancelEvents).toHaveLength(1);
    expect(cancelEvents[0].payload).toMatchObject({ reason: "cancel_on_reply", cancelledCount: 1, excludeSkillIds: ["skill-b"] });
  });

  it("refuses to schedule against an actionId that belongs to a different org", async () => {
    const followUpsRepo = createFollowUpsRepo(db);
    const [otherOrg] = await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Other Org", slug: "other-org-followups", createdAt: new Date() })
      .returning();
    const wrongCtx = { orgId: otherOrg.id, userId: "system", role: "owner" };

    await expect(
      followUpsRepo.schedule(wrongCtx, { actionId, skillId: "echo", dueAt: new Date(), touchIndex: 9 }),
    ).rejects.toThrow(/does not belong to org/);

    await db.delete(organization).where(eq(organization.id, otherOrg.id));
  });
});
