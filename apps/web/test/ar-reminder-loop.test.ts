import { describe, it, expect, beforeAll, afterEach, afterAll, vi } from "vitest";
import { and, eq } from "drizzle-orm";
import { PgUpdateBuilder } from "drizzle-orm/pg-core";
import { db, organization, contacts, messages, runs, actions, auditLog, followUps, orgSkillConfig, sweepArReminderCron, sweepExpiredActions, createOrgSkillConfigRepo } from "@agentos/core";
// finding 14 (adversarial review round 1): `skillArInvoices` is a
// @agentos/skills export, not re-exported through @agentos/core (Task 5's
// no-re-export rule) — importing it from the wrong package is a type error,
// not a runtime symptom, so it would only surface at `npm run typecheck`.
import { skillArInvoices } from "@agentos/skills";
import { matchAndRun } from "../lib/router";
import { decideAction } from "../lib/approve";

describe("ar-reminder — full loop (spec § 10)", () => {
  let orgId: string, invoiceId: string;

  beforeAll(async () => {
    const [org] = await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "AR Loop Test Org", slug: "ar-loop-test-org", createdAt: new Date() })
      .returning();
    orgId = org.id;
    const [contact] = await db.insert(contacts)
      .values({ id: crypto.randomUUID(), orgId, name: "Overdue Customer", emails: ["customer@ar-loop-test.example.com"] })
      .returning();
    const [invoice] = await db.insert(skillArInvoices)
      .values({
        id: crypto.randomUUID(), orgId, contactId: contact.id, invoiceNumber: "INV-1001", amountCents: 4200,
        dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000), stage: "issued",
      })
      .returning();
    invoiceId = invoice.id;
  });

  afterEach(async () => {
    // finding 5 (adversarial review round 1): scope every delete to this
    // test's own orgId — an unscoped delete on a shared dev/test DB clears
    // rows other suites or a concurrent seed run left behind, matching this
    // repo's own house rule (every domain table carries org_id).
    await db.delete(auditLog).where(eq(auditLog.orgId, orgId));
    await db.delete(followUps).where(eq(followUps.orgId, orgId));
    await db.delete(actions).where(eq(actions.orgId, orgId));
    await db.delete(runs).where(eq(runs.orgId, orgId));
  });

  afterAll(async () => {
    await db.delete(skillArInvoices).where(eq(skillArInvoices.orgId, orgId));
    await db.delete(messages).where(eq(messages.orgId, orgId));
    await db.delete(contacts).where(eq(contacts.orgId, orgId));
    await db.delete(orgSkillConfig).where(eq(orgSkillConfig.orgId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
  });

  it("cron finds the overdue invoice; approving mock-sends, sets entity_ref, schedules 3/7/14-day follow-ups; a reply cancels the remaining touches", async () => {
    const swept = await sweepArReminderCron();
    expect(swept.triggered).toBe(1);

    const [run] = await db.select().from(runs).where(eq(runs.orgId, orgId));
    expect(run.skillId).toBe("ar-reminder");
    expect(run.entityRef).toEqual({ table: "skill_ar_invoices", id: invoiceId });

    const [invoiceAfterCron] = await db.select().from(skillArInvoices).where(eq(skillArInvoices.id, invoiceId));
    expect(invoiceAfterCron.stage).toBe("reminded");

    const [action] = await db.select().from(actions).where(eq(actions.orgId, orgId));
    const ctx = { orgId, userId: "operator@example.com", role: "owner" };
    const result = await decideAction(ctx, action.id, "approved");
    expect(result.status).toBe("done");

    const scheduled = await db.select().from(followUps).where(eq(followUps.actionId, action.id));
    expect(scheduled).toHaveLength(3);
    expect(scheduled.map((f) => f.touchIndex).sort()).toEqual([0, 1, 2]);

    // A mock inbound reply from the same contact cancels the remaining
    // touches (spec § 4.4). It also matches echo's own "any mock message"
    // trigger and spawns an unrelated echo run — harmless, not asserted on.
    await matchAndRun({
      from: "customer@ar-loop-test.example.com", to: "ops@example.com",
      subject: "Re: reminder", body: "Paying now, thanks!", providerMessageId: "p-ar-loop-reply-1",
    });

    const afterReply = await db.select().from(followUps).where(eq(followUps.actionId, action.id));
    expect(afterReply.every((f) => f.status === "cancelled")).toBe(true);
  });

  it("scopes the cron stage-flip UPDATE to the invoice's organization", async () => {
    await db.update(skillArInvoices).set({ stage: "issued", updatedAt: new Date() })
      .where(and(eq(skillArInvoices.id, invoiceId), eq(skillArInvoices.orgId, orgId)));

    const setSpy = vi.spyOn(PgUpdateBuilder.prototype, "set");
    try {
      await sweepArReminderCron();

      const invoiceUpdate = setSpy.mock.results
        .map((result) => result.value)
        .find((value): value is { toSQL: () => { sql: string; params: unknown[] } } => {
          if (!value || typeof value !== "object" || !("toSQL" in value) || typeof value.toSQL !== "function") return false;
          return value.toSQL().sql.includes("skill_ar_invoices");
        });
      expect(invoiceUpdate).toBeDefined();

      const query = invoiceUpdate!.toSQL();
      expect(query.sql).toContain('"skill_ar_invoices"."id"');
      expect(query.sql).toContain('"skill_ar_invoices"."org_id"');
      expect(query.params).toContain(orgId);
    } finally {
      setSpy.mockRestore();
    }
  });

  it("is idempotent — an invoice already moved past 'issued' is not re-triggered by a second sweep", async () => {
    await sweepArReminderCron();
    const runsAfterFirst = await db.select().from(runs).where(eq(runs.orgId, orgId));
    const second = await sweepArReminderCron();
    expect(second.triggered).toBe(0);
    const runsAfterSecond = await db.select().from(runs).where(eq(runs.orgId, orgId));
    expect(runsAfterSecond).toHaveLength(runsAfterFirst.length);
  });

  it("N1 (final review, sustained by judge): denying a reminder action declines the invoice — the cron sweep does not re-trigger it", async () => {
    await db.update(skillArInvoices).set({ stage: "issued", updatedAt: new Date() })
      .where(and(eq(skillArInvoices.id, invoiceId), eq(skillArInvoices.orgId, orgId)));

    const swept = await sweepArReminderCron();
    expect(swept.triggered).toBe(1);

    const [action] = await db.select().from(actions).where(eq(actions.orgId, orgId));
    const ctx = { orgId, userId: "operator@example.com", role: "owner" };
    const result = await decideAction(ctx, action.id, "denied");
    expect(result.status).toBe("denied");

    const [invoiceAfterDeny] = await db.select().from(skillArInvoices).where(eq(skillArInvoices.id, invoiceId));
    expect(invoiceAfterDeny.stage).toBe("declined");

    const secondSweep = await sweepArReminderCron();
    expect(secondSweep.triggered).toBe(0);
  });

  it("N1 (final review, sustained by judge): an ignored reminder action expires and declines the invoice — no infinite retry loop", async () => {
    await db.update(skillArInvoices).set({ stage: "issued", updatedAt: new Date() })
      .where(and(eq(skillArInvoices.id, invoiceId), eq(skillArInvoices.orgId, orgId)));

    const swept = await sweepArReminderCron();
    expect(swept.triggered).toBe(1);

    const [action] = await db.select().from(actions).where(eq(actions.orgId, orgId));
    await db.update(actions).set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(actions.id, action.id));

    const result = await sweepExpiredActions();
    expect(result.expired).toBeGreaterThanOrEqual(1);

    const [invoiceAfterExpiry] = await db.select().from(skillArInvoices).where(eq(skillArInvoices.id, invoiceId));
    expect(invoiceAfterExpiry.stage).toBe("declined");

    const secondSweep = await sweepArReminderCron();
    expect(secondSweep.triggered).toBe(0);
  });

  it("finding 13 (adversarial review round 1): the skill test harness (Task 4) also drives ar-reminder, not just echo", async () => {
    const { runSkillLoop, fixtureMessage, arReminderSkill } = await import("@agentos/skills");
    const message = fixtureMessage({
      body: "Invoice INV-9999 (amount 1000) was due 2020-01-01 and is still unpaid.",
      raw: { invoiceId: "fixture-invoice-1" },
    });
    const { intent, draft, result, sentMessages } = await runSkillLoop(arReminderSkill, message);
    expect(intent.invoiceId).toBe("fixture-invoice-1");
    expect(draft).toMatchObject({ kind: "reminder", invoiceId: "fixture-invoice-1" });
    expect(result.ok).toBe(true);
    expect(sentMessages).toHaveLength(1);
  });

  it("a disabled ar-reminder skill is never triggered by the cron sweep", async () => {
    await db.update(skillArInvoices).set({ stage: "issued", updatedAt: new Date() })
      .where(and(eq(skillArInvoices.id, invoiceId), eq(skillArInvoices.orgId, orgId)));
    await createOrgSkillConfigRepo(db).upsert(
      { orgId, userId: "system", role: "owner" },
      "ar-reminder",
      { enabled: false, config: {} },
    );

    const swept = await sweepArReminderCron();
    expect(swept.triggered).toBe(0);

    const [invoiceAfter] = await db.select().from(skillArInvoices).where(eq(skillArInvoices.id, invoiceId));
    expect(invoiceAfter.stage).toBe("issued");

    await createOrgSkillConfigRepo(db).upsert(
      { orgId, userId: "system", role: "owner" },
      "ar-reminder",
      { enabled: true, config: {} },
    );
    const sweptAfterReenable = await sweepArReminderCron();
    expect(sweptAfterReenable.triggered).toBe(1);
  });
});
