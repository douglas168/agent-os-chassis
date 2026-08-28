import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { organization, messages, runs, contacts } from "../src/db/schema";
import { createMessagesRepo } from "../src/repositories/messages";
import { createRunsRepo } from "../src/repositories/runs";
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

  afterAll(async () => {
    await db.delete(runs);
    await db.delete(messages);
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
