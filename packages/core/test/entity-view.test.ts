import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { actions, contacts, documents, organization, runs } from "../src/db/schema";
import { createActionsRepo } from "../src/repositories/actions";
import { createRunsRepo } from "../src/repositories/runs";
import { loadEntityView } from "../src/engine/entity-view";
import { skillArInvoices } from "@agentos/skills";

describe("documents.entity_ref column", () => {
  let orgId: string;
  const ids: string[] = [];

  beforeAll(async () => {
    const [org] = await db.insert(organization).values({
      id: crypto.randomUUID(),
      name: "Entity Ref Test Org",
      slug: `entity-ref-test-org-${crypto.randomUUID()}`,
      createdAt: new Date(),
    }).returning();
    orgId = org.id;
  });

  afterEach(async () => {
    for (const id of ids.splice(0)) {
      await db.delete(documents).where(eq(documents.id, id));
    }
  });

  afterAll(async () => {
    await db.delete(organization).where(eq(organization.id, orgId));
  });

  it("stores and reads back an entity_ref jsonb value", async () => {
    const [row] = await db.insert(documents).values({
      orgId,
      title: "Invoice PDF",
      source: "upload",
      mime: "application/pdf",
      sizeBytes: 1024,
      storageKey: "k1",
      entityRef: { table: "skill_ar_invoices", id: "some-invoice-id" },
    }).returning();
    ids.push(row.id);

    expect(row.entityRef).toEqual({ table: "skill_ar_invoices", id: "some-invoice-id" });
  });
});

describe("loadEntityView — contact, documents, pendingActions", () => {
  let orgId: string;
  let contactId: string;
  let invoiceId: string;
  let runId: string;

  beforeAll(async () => {
    const [org] = await db.insert(organization).values({
      id: crypto.randomUUID(),
      name: "Entity View Org",
      slug: `entity-view-org-${crypto.randomUUID()}`,
      createdAt: new Date(),
    }).returning();
    orgId = org.id;

    const [contact] = await db.insert(contacts).values({
      id: crypto.randomUUID(),
      orgId,
      name: "Entity View Contact",
      emails: ["ev@example.com"],
    }).returning();
    contactId = contact.id;

    const [invoice] = await db.insert(skillArInvoices).values({
      id: crypto.randomUUID(),
      orgId,
      contactId,
      invoiceNumber: "INV-EV-1",
      amountCents: 1000,
      dueAt: new Date(),
      stage: "issued",
    }).returning();
    invoiceId = invoice.id;

    await db.insert(documents).values({
      orgId,
      title: "Attached PDF",
      source: "upload",
      mime: "application/pdf",
      sizeBytes: 100,
      storageKey: "k-ev-1",
      entityRef: { table: "skill_ar_invoices", id: invoiceId },
    });

    const ctx = { orgId, userId: "system", role: "owner" };
    const run = await createRunsRepo(db).create(ctx, {
      skillId: "ar-reminder",
      mastraRunId: "mr-ev-1",
      entityRef: { table: "skill_ar_invoices", id: invoiceId },
    });
    runId = run.id;
    await createActionsRepo(db).create(ctx, {
      runId,
      skillId: "ar-reminder",
      kind: "reminder",
      draft: {},
      expiresAt: new Date(Date.now() + 3600_000),
      idempotencyKey: crypto.randomUUID(),
    });
  });

  afterAll(async () => {
    await db.delete(actions).where(eq(actions.orgId, orgId));
    await db.delete(runs).where(eq(runs.orgId, orgId));
    await db.delete(documents).where(eq(documents.orgId, orgId));
    await db.delete(skillArInvoices).where(eq(skillArInvoices.orgId, orgId));
    await db.delete(contacts).where(eq(contacts.orgId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
  });

  it("includes the linked contact, entity-scoped documents, and pending actions for this entity's runs", async () => {
    const view = await loadEntityView({ orgId, userId: "system", role: "owner" }, invoiceId);

    expect(view?.contact).toEqual({ id: contactId, name: "Entity View Contact", company: null });
    expect(view?.documents).toEqual([{
      id: expect.any(String),
      title: "Attached PDF",
      mime: "application/pdf",
      sizeBytes: 100,
    }]);
    expect(view?.pendingActions).toHaveLength(1);
    expect(view?.pendingActions[0].runId).toBe(runId);
    expect(view?.pendingActions[0].editableFields).toEqual(["subject", "body"]);
  });
});
