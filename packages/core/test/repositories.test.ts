import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { and, eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { organization, messages, runs } from "../src/db/schema";
import { createMessagesRepo } from "../src/repositories/messages";
import { createRunsRepo } from "../src/repositories/runs";

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
