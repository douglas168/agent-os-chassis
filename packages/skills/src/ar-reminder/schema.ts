import { pgTable, uuid, text, timestamp, integer } from "drizzle-orm/pg-core";

// Spec § 5.1 rule 1: skill_<id>_ prefix. Rule 2: org_id, org-scoped.
// org_id/contact_id are plain uuid, not FK'd to organization/contacts —
// those live in @agentos/core's schema, and packages/skills cannot depend
// on @agentos/core (the dependency runs the other way); see this task's
// Least-confident decision #3. amountCents is integer, not numeric — an
// integer-cents column needs no fractional precision and no mode-coercion
// option; Drizzle's `numeric` returns a string by default and `{mode:
// "number"}` is a version-dependent opt-in this repo hasn't otherwise used.
export const skillArInvoices = pgTable("skill_ar_invoices", {
  id: uuid("id").primaryKey().defaultRandom(),
  orgId: uuid("org_id").notNull(),
  contactId: uuid("contact_id").notNull(),
  invoiceNumber: text("invoice_number").notNull(),
  amountCents: integer("amount_cents").notNull(),
  dueAt: timestamp("due_at").notNull(),
  // issued -> due -> reminded -> escalated -> paid (spec § 8.1's stage
  // stepper). Only issued -> reminded has driving logic in this plan
  // (Task 6's cron sweep) — due/escalated/paid are declared for the
  // stepper's visual completeness, not wired transitions. "declined" is a
  // terminal value added outside spec § 8.1's stepper (final review N1,
  // Gate B Option B, 2026-09-02) — set by a denied or expired reminder
  // action (packages/core/src/engine/decline-entity.ts) so the invoice
  // stops being redrafted on every cron tick. No unstick path exists yet;
  // an operator must manually issue a new invoice or edit the row.
  stage: text("stage").notNull().default("issued"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});
