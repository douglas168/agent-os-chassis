import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { db } from "../src/db/client";
import { organizations, messages } from "../src/db/schema";
import { createOrganizationsRepo } from "../src/repositories/organizations";
import { createMessagesRepo } from "../src/repositories/messages";

describe("org-scoped repositories", () => {
  let orgA: { id: string }, orgB: { id: string };

  beforeAll(async () => {
    const orgsRepo = createOrganizationsRepo(db);
    orgA = await orgsRepo.create({ name: "Org A" });
    orgB = await orgsRepo.create({ name: "Org B" });
  });

  afterAll(async () => {
    await db.delete(messages);
    await db.delete(organizations);
  });

  it("scopes messages to the creating org and hides them from another org", async () => {
    const messagesRepo = createMessagesRepo(db);
    await messagesRepo.create({ orgId: orgA.id }, {
      channel: "mock", direction: "in", providerMessageId: "m1",
      from: "a@example.com", to: "b@example.com", body: "hello",
    });

    const seenByA = await messagesRepo.listForOrg({ orgId: orgA.id });
    const seenByB = await messagesRepo.listForOrg({ orgId: orgB.id });

    expect(seenByA).toHaveLength(1);
    expect(seenByB).toHaveLength(0);
  });
});
