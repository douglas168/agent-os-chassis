import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { and, eq, inArray } from "drizzle-orm";
import { db } from "../src/db/client";
import { organization, messages, runs, actions, contacts } from "../src/db/schema";
import { createMessagesRepo } from "../src/repositories/messages";
import { createRunsRepo } from "../src/repositories/runs";
import { createActionsRepo } from "../src/repositories/actions";
import { createContactsRepo } from "../src/repositories/contacts";

describe("org-scoped repositories", () => {
  let orgA: { id: string }, orgB: { id: string };

  beforeAll(async () => {
    [orgA] = await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Org A", slug: "org-a", createdAt: new Date() })
      .returning();
    [orgB] = await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Org B", slug: "org-b", createdAt: new Date() })
      .returning();
  });

  afterEach(async () => {
    const orgIds = [orgA.id, orgB.id];
    await db.delete(actions).where(inArray(actions.orgId, orgIds));
    await db.delete(runs).where(inArray(runs.orgId, orgIds));
    await db.delete(messages).where(inArray(messages.orgId, orgIds));
    await db.delete(contacts).where(inArray(contacts.orgId, orgIds));
  });

  afterAll(async () => {
    await db.delete(actions);
    await db.delete(runs);
    await db.delete(messages);
    await db.delete(contacts);
    await db.delete(organization);
  });

  it("scopes messages to the creating org and hides them from another org", async () => {
    const messagesRepo = createMessagesRepo(db);
    await messagesRepo.create({ orgId: orgA.id }, {
      channel: "mock", direction: "in", providerMessageId: "m1",
      from: "a@example.com", to: "b@example.com", body: "hello",
    });

    const seenByA = await messagesRepo.listForOrg({ orgId: orgA.id, userId: "system", role: "owner" });
    const seenByB = await messagesRepo.listForOrg({ orgId: orgB.id, userId: "system", role: "owner" });

    expect(seenByA).toHaveLength(1);
    expect(seenByB).toHaveLength(0);
  });

  it("cross-org: updateStatus only updates the run belonging to the calling org", async () => {
    const runsRepo = createRunsRepo(db);
    const runA = await runsRepo.create({ orgId: orgA.id, userId: "system", role: "owner" }, {
      skillId: "echo", mastraRunId: "mr-cross-org-1",
    });

    await runsRepo.updateStatus({ orgId: orgB.id, userId: "system", role: "owner" }, runA.id, "done");

    const [reloaded] = await db.select().from(runs).where(eq(runs.id, runA.id));
    expect(reloaded.status).toBe("running");
  });

  it("cross-org: findByMastraRunId never returns a row belonging to a different org", async () => {
    const runsRepo = createRunsRepo(db);
    await runsRepo.create({ orgId: orgA.id, userId: "system", role: "owner" }, {
      skillId: "echo", mastraRunId: "mr-cross-org-2",
    });

    const found = await runsRepo.findByMastraRunId({ orgId: orgB.id, userId: "system", role: "owner" }, "mr-cross-org-2");
    expect(found).toBeNull();
  });

  it("findForEntity returns only runs whose entity_ref matches the given table+id, scoped to the calling org", async () => {
    const runsRepo = createRunsRepo(db);
    const target = await runsRepo.create({ orgId: orgA.id, userId: "system", role: "owner" }, {
      skillId: "ar-reminder", mastraRunId: "mr-entity-1", entityRef: { table: "skill_ar_invoices", id: "inv-1" },
    });
    await runsRepo.create({ orgId: orgA.id, userId: "system", role: "owner" }, {
      skillId: "ar-reminder", mastraRunId: "mr-entity-2", entityRef: { table: "skill_ar_invoices", id: "inv-2" },
    });
    await runsRepo.create({ orgId: orgB.id, userId: "system", role: "owner" }, {
      skillId: "ar-reminder", mastraRunId: "mr-entity-3", entityRef: { table: "skill_ar_invoices", id: "inv-1" },
    });

    const found = await runsRepo.findForEntity({ orgId: orgA.id, userId: "system", role: "owner" }, { table: "skill_ar_invoices", id: "inv-1" });
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe(target.id);
  });

  it("countUnmatched counts only this org's contact-less messages", async () => {
    const messagesRepo = createMessagesRepo(db);
    const ctxA = { orgId: orgA.id, userId: "system", role: "owner" };
    const ctxB = { orgId: orgB.id, userId: "system", role: "owner" };
    const [someContact] = await db.insert(contacts).values({
      id: crypto.randomUUID(), orgId: orgA.id, name: "Matched Contact", emails: ["x@example.com"],
    }).returning();

    await messagesRepo.create(ctxA, {
      channel: "mock", direction: "in", providerMessageId: "unmatched-1", from: "x@example.com", to: "y@example.com", body: "hi",
    });
    await messagesRepo.create(ctxA, {
      channel: "mock", direction: "in", providerMessageId: "matched-1", from: "x@example.com", to: "y@example.com", body: "hi", contactId: someContact.id,
    });
    await messagesRepo.create(ctxB, {
      channel: "mock", direction: "in", providerMessageId: "unmatched-other-org", from: "x@example.com", to: "y@example.com", body: "hi",
    });

    const count = await messagesRepo.countUnmatched(ctxA);
    expect(count).toBe(1);
  });

  it("countUnmatched excludes outbound messages (adversarial review round 1, finding 15)", async () => {
    const messagesRepo = createMessagesRepo(db);
    await messagesRepo.create({ orgId: orgA.id, userId: "system", role: "owner" }, {
      channel: "mock", direction: "out", providerMessageId: "outbound-1", from: "y@example.com", to: "x@example.com", body: "reply",
    });
    const count = await messagesRepo.countUnmatched({ orgId: orgA.id, userId: "system", role: "owner" });
    expect(count).toBe(0);
  });

  it("listByStatus returns only actions in the given status, org-scoped", async () => {
    const actionsRepo = createActionsRepo(db);
    const ctx = { orgId: orgA.id, userId: "system", role: "owner" };
    const run = await createRunsRepo(db).create(ctx, { skillId: "echo", mastraRunId: "mr-status-1" });
    const action = await actionsRepo.create(ctx, {
      runId: run.id, skillId: "echo", kind: "reply", draft: {},
      expiresAt: new Date(Date.now() - 1000), idempotencyKey: crypto.randomUUID(),
    });
    await db.update(actions).set({ status: "expired" }).where(eq(actions.id, action.id));

    const found = await actionsRepo.listByStatus(ctx, "expired");
    expect(found.map((a) => a.id)).toContain(action.id);

    const foundForOtherOrg = await actionsRepo.listByStatus(
      { orgId: orgB.id, userId: "system", role: "owner" },
      "expired",
    );
    expect(foundForOtherOrg.map((a) => a.id)).not.toContain(action.id);
  });
});

describe("contacts repository", () => {
  let org: { id: string };

  beforeAll(async () => {
    [org] = await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Contacts Test Org", slug: "contacts-test-org", createdAt: new Date() })
      .returning();
  });

  afterAll(async () => {
    await db.delete(contacts);
    await db.delete(organization).where(eq(organization.id, org.id));
  });

  it("finds a contact whose emails array contains the given address", async () => {
    await db.insert(contacts).values({
      id: crypto.randomUUID(), orgId: org.id, name: "Jane", emails: ["jane@example.com", "j@example.com"],
    });

    const contactsRepo = createContactsRepo(db);
    const found = await contactsRepo.findByEmail({ orgId: org.id, userId: "system", role: "owner" }, "j@example.com");
    expect(found?.name).toBe("Jane");

    const notFound = await contactsRepo.findByEmail({ orgId: org.id, userId: "system", role: "owner" }, "nobody@example.com");
    expect(notFound).toBeNull();
  });
});
