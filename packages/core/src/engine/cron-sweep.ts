import { and, eq, lte } from "drizzle-orm";
import { db } from "../db/client";
import { organization, contacts } from "../db/schema";
import { createMessagesRepo } from "../repositories/messages";
import { runSkillForMessage } from "./run-skill";
import { skillArInvoices, arReminderSkill } from "@agentos/skills";
import type { OrgContext } from "../context";

export async function sweepArReminderCron(): Promise<{ triggered: number }> {
  const orgs = await db.select().from(organization);
  let triggered = 0;

  for (const org of orgs) {
    const ctx: OrgContext = { orgId: org.id, userId: "system", role: "system" };
    const overdue = await db.select().from(skillArInvoices)
      .where(and(eq(skillArInvoices.orgId, org.id), lte(skillArInvoices.dueAt, new Date()), eq(skillArInvoices.stage, "issued")));

    for (const invoice of overdue) {
      // finding 15 (adversarial review round 1): org-scope the contact
      // lookup — an id-only WHERE lets one org's invoice resolve to
      // another org's contact row if the uuid happens to exist there,
      // leaking that contact's email into this org's outbound reminder.
      const [contact] = await db.select().from(contacts).where(and(eq(contacts.id, invoice.contactId), eq(contacts.orgId, org.id)));
      if (!contact) continue;
      const contactEmails = contact.emails as string[];

      // This is a synthetic, cron-fabricated inbound message—not a real customer reply—used
      // to drive the AR-reminder skill's message-shaped trigger. It is distinguishable from
      // genuine inbound traffic only by the ar-reminder-cron- prefix on providerMessageId;
      // a human looking at /traces would not notice, because from and body look real. This is
      // a known, disclosed limitation of the cron-trigger pattern, not a bug. A forker adding
      // a real cron-triggered skill should preserve this prefix convention or add
      // synthetic: true to raw if its skill's trace UI needs to distinguish the message.
      const inbound = {
        channel: "mock" as const, direction: "in" as const,
        from: contactEmails[0] ?? "unknown@example.com", to: "ops@example.com",
        subject: `Invoice ${invoice.invoiceNumber} overdue`,
        body: `Invoice ${invoice.invoiceNumber} (amount ${invoice.amountCents}) was due ${invoice.dueAt.toISOString().slice(0, 10)} and is still unpaid.`,
        providerMessageId: `ar-reminder-cron-${invoice.id}-${crypto.randomUUID()}`,
        raw: { invoiceId: invoice.id },
      };

      const messagesRepo = createMessagesRepo(db);
      const message = await messagesRepo.create(ctx, {
        channel: inbound.channel, direction: inbound.direction, providerMessageId: inbound.providerMessageId,
        from: inbound.from, to: inbound.to, subject: inbound.subject, body: inbound.body, raw: inbound.raw,
        contactId: contact.id,
      });

      await runSkillForMessage(ctx, arReminderSkill, inbound, message.id, { table: "skill_ar_invoices", id: invoice.id });
      // finding 3 (adversarial review round 1): flip stage AFTER a
      // successful runSkillForMessage, not before — flipping first meant a
      // thrown error left the invoice permanently marked "reminded" with
      // no action ever created, silently dropping the reminder forever.
      // Disclosed trade-off: a crash between runSkillForMessage's return
      // and this UPDATE now risks a duplicate reminder on the next sweep
      // instead — recoverable (a second approval/decline), not silent. A
      // re-run of this sweep still skips an already-"reminded" invoice, not
      // because of a cross-process lock (spec § 3's single-worker-process
      // design already rules out a concurrent second sweep process — the
      // in-process guard in apps/worker/src/index.ts covers overlapping
      // ticks within that one process).
      await db.update(skillArInvoices).set({ stage: "reminded", updatedAt: new Date() })
        .where(and(eq(skillArInvoices.id, invoice.id), eq(skillArInvoices.orgId, org.id)));
      triggered += 1;
    }
  }
  return { triggered };
}
