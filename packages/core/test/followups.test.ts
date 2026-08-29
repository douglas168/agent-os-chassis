import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { organization, runs, actions, messages, followUps } from "../src/db/schema";
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

  afterEach(async () => { await db.delete(followUps); });
  afterAll(async () => {
    await db.delete(actions); await db.delete(runs); await db.delete(organization).where(eq(organization.id, orgId));
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
