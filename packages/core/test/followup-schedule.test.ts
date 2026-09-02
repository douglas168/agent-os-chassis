import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { organization, messages, runs, actions, followUps } from "../src/db/schema";
import { scheduleFollowUpsForAction } from "../src/engine/followup-schedule";
import type { Skill } from "@agentos/skills";

describe("scheduleFollowUpsForAction", () => {
  let orgId: string, actionId: string;

  beforeAll(async () => {
    const [org] = await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Followup Schedule Test Org", slug: "followup-schedule-test-org", createdAt: new Date() })
      .returning();
    orgId = org.id;
    const [message] = await db.insert(messages).values({
      id: crypto.randomUUID(), orgId, channel: "mock", direction: "in", providerMessageId: "p-fs-1",
      from: "a@example.com", to: "b@example.com", body: "hi",
    }).returning();
    const [run] = await db.insert(runs).values({ id: crypto.randomUUID(), orgId, skillId: "fake-skill", messageId: message.id, mastraRunId: "mr-fs-1" }).returning();
    const [action] = await db.insert(actions).values({
      id: crypto.randomUUID(), orgId, runId: run.id, skillId: "fake-skill", kind: "reply", draft: {},
      idempotencyKey: "fs-test-1", expiresAt: new Date(Date.now() + 3600_000),
    }).returning();
    actionId = action.id;
  });

  afterAll(async () => {
    await db.delete(followUps).where(eq(followUps.orgId, orgId));
    await db.delete(actions).where(eq(actions.orgId, orgId));
    await db.delete(runs).where(eq(runs.orgId, orgId));
    await db.delete(messages).where(eq(messages.orgId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
  });

  it("schedules one follow_ups row per declared offset", async () => {
    const fakeSkill = { manifest: { id: "fake-skill" }, followups: { offsets: [3, 7, 14] } } as Skill<any, any>;
    const ctx = { orgId, userId: "system", role: "system" };

    const scheduled = await scheduleFollowUpsForAction(ctx, fakeSkill, actionId);
    expect(scheduled).toBe(3);

    const rows = await db.select().from(followUps).where(eq(followUps.actionId, actionId));
    expect(rows).toHaveLength(3);
    expect(rows.map((r) => r.touchIndex).sort()).toEqual([0, 1, 2]);
  });

  it("schedules nothing for a skill with no followups declaration", async () => {
    const bareSkill = { manifest: { id: "fake-skill" } } as Skill<any, any>;
    const ctx = { orgId, userId: "system", role: "system" };
    const scheduled = await scheduleFollowUpsForAction(ctx, bareSkill, actionId);
    expect(scheduled).toBe(0);
  });

  it("finding 11 (adversarial review round 1): does not re-schedule for an action that is itself a follow-up re-entry", async () => {
    // A follow-up re-entry (followup-sweep.ts) always reuses the ORIGIN
    // message's id for the new run it creates — so a second action whose
    // run points at the same messageId as an action that already has
    // follow_ups scheduled must be treated as a re-entry, not an original.
    const fakeSkill = { manifest: { id: "fake-skill" }, followups: { offsets: [3, 7, 14] } } as Skill<any, any>;
    const ctx = { orgId, userId: "system", role: "system" };

    await scheduleFollowUpsForAction(ctx, fakeSkill, actionId); // original approval — 3 rows

    const [originAction] = await db.select().from(actions).where(eq(actions.id, actionId));
    const [reentryAction] = await db.insert(actions).values({
      id: crypto.randomUUID(), orgId, runId: originAction.runId, skillId: "fake-skill", kind: "reply", draft: {},
      idempotencyKey: "fs-test-reentry", expiresAt: new Date(Date.now() + 3600_000),
    }).returning();

    const scheduledAgain = await scheduleFollowUpsForAction(ctx, fakeSkill, reentryAction.id);
    expect(scheduledAgain).toBe(0);

    const rows = await db.select().from(followUps).where(eq(followUps.actionId, reentryAction.id));
    expect(rows).toHaveLength(0);
  });
});
