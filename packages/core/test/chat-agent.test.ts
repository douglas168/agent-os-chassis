import { afterEach, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import {
  actions,
  contacts,
  documents,
  messages,
  orgSkillConfig,
  organization,
  runs,
} from "../src/db/schema";
import { createActionsRepo } from "../src/repositories/actions";
import { createDocumentsRepo } from "../src/repositories/documents";
import { createOrgSkillConfigRepo } from "../src/repositories/org-skill-config";
import { createRunsRepo } from "../src/repositories/runs";
import {
  buildChatAgent,
  createListRecentRunsTool,
  createPresentPendingActionTool,
  createRunSkillTool,
  createSearchContactsTool,
  createSearchDocumentsTool,
} from "../src/engine/chat-agent";

describe("chat agent tools", () => {
  async function makeOrg(name: string) {
    const [row] = await db.insert(organization)
      .values({
        id: crypto.randomUUID(),
        name,
        slug: `${name.toLowerCase()}-${crypto.randomUUID()}`,
        createdAt: new Date(),
      })
      .returning();
    return row;
  }

  afterEach(async () => {
    await db.delete(actions);
    await db.delete(runs);
    await db.delete(messages);
    await db.delete(orgSkillConfig);
    await db.delete(contacts);
    await db.delete(documents);
    await db.delete(organization);
  });

  it("searchDocuments finds a document by extracted text, org-scoped", async () => {
    const org = await makeOrg("Chat Search Docs Org");
    const otherOrg = await makeOrg("Chat Search Docs Other Org");
    const ctx = { orgId: org.id, userId: "system", role: "owner" };
    await createDocumentsRepo(db).create(ctx, {
      title: "invoice policy",
      source: "upload",
      mime: "text/plain",
      sizeBytes: 30,
      storageKey: "docs/policy.txt",
      text: "overdue invoices escalate after fourteen days",
    });
    await createDocumentsRepo(db).create(
      { orgId: otherOrg.id, userId: "system", role: "owner" },
      {
        title: "other org doc",
        source: "upload",
        mime: "text/plain",
        sizeBytes: 20,
        storageKey: "docs/other.txt",
        text: "overdue invoices in another org",
      },
    );

    const result = await createSearchDocumentsTool(ctx).execute({ query: "overdue invoices" });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].title).toBe("invoice policy");
  });

  it("searchContacts finds a contact by name, org-scoped", async () => {
    const org = await makeOrg("Chat Tools Org");
    const otherOrg = await makeOrg("Chat Tools Other Org");
    const ctx = { orgId: org.id, userId: "system", role: "owner" };
    await db.insert(contacts).values({
      id: crypto.randomUUID(),
      orgId: org.id,
      name: "Jane Doe",
      emails: ["jane@example.com"],
    });
    await db.insert(contacts).values({
      id: crypto.randomUUID(),
      orgId: otherOrg.id,
      name: "Jane Other Org",
      emails: ["jane2@example.com"],
    });

    const result = await createSearchContactsTool(ctx).execute({ query: "jane" });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].name).toBe("Jane Doe");
  });

  it("listRecentRuns returns this org's runs newest first, capped at the given limit", async () => {
    const org = await makeOrg("Chat Runs Org");
    const ctx = { orgId: org.id, userId: "system", role: "owner" };
    const runsRepo = createRunsRepo(db);
    await runsRepo.create(ctx, {
      skillId: "echo",
      mastraRunId: `mr-chat-1-${crypto.randomUUID()}`,
    });
    const second = await runsRepo.create(ctx, {
      skillId: "echo",
      mastraRunId: `mr-chat-2-${crypto.randomUUID()}`,
    });

    const result = await createListRecentRunsTool(ctx).execute({ limit: 1 });
    expect(result.results).toHaveLength(1);
    expect(result.results[0].id).toBe(second.id);
  });

  it("runSkill inserts a chat-channel message, triggers the skill, and returns the DB run id + actionId", async () => {
    const org = await makeOrg("Chat Run Skill Org");
    const ctx = { orgId: org.id, userId: "operator-1", role: "operator" };

    const result = await createRunSkillTool(ctx).execute({
      skillId: "echo",
      message: "please echo hello",
    });
    expect(result.ok).toBe(true);
    expect(result.runId).toBeTruthy();
    expect(result.actionId).toBeTruthy();

    const [runRow] = await db.select().from(runs).where(eq(runs.id, result.runId!));
    expect(runRow).toBeDefined();

    const [insertedMessage] = await db.select().from(messages).where(eq(messages.orgId, org.id));
    expect(insertedMessage.channel).toBe("chat");
    expect(insertedMessage.body).toBe("please echo hello");
  });

  it("runSkill refuses a skill this org has disabled", async () => {
    const org = await makeOrg("Chat Disabled Skill Org");
    const ctx = { orgId: org.id, userId: "operator-1", role: "operator" };
    await createOrgSkillConfigRepo(db).upsert(ctx, "echo", { enabled: false, config: {} });

    const result = await createRunSkillTool(ctx).execute({
      skillId: "echo",
      message: "please echo hello",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("disabled");
  });

  it("runSkill refuses an unknown skillId", async () => {
    const org = await makeOrg("Chat Unknown Skill Org");
    const ctx = { orgId: org.id, userId: "operator-1", role: "operator" };

    const result = await createRunSkillTool(ctx).execute({
      skillId: "no-such-skill",
      message: "hi",
    });
    expect(result.ok).toBe(false);
    expect(result.error).toContain("unknown skill");
  });

  it("buildChatAgent's model config resolves without throwing", async () => {
    const org = await makeOrg("Chat Model Resolution Org");
    const ctx = { orgId: org.id, userId: "system", role: "owner" };
    const agent = buildChatAgent(ctx);
    await expect(agent.getModel()).resolves.toBeDefined();
  });

  it("presentPendingAction returns the action shaped for ApprovalCard, org-scoped", async () => {
    const org = await makeOrg("Chat Decide Org");
    const otherOrg = await makeOrg("Chat Decide Other Org");
    const ctx = { orgId: org.id, userId: "system", role: "owner" };
    const run = await createRunsRepo(db).create(ctx, {
      skillId: "ar-reminder",
      mastraRunId: `mr-decide-${crypto.randomUUID()}`,
    });
    const action = await createActionsRepo(db).create(ctx, {
      runId: run.id,
      skillId: "ar-reminder",
      kind: "reply",
      draft: { body: "hi" },
      expiresAt: new Date(Date.now() + 3_600_000),
      idempotencyKey: crypto.randomUUID(),
    });

    const found = await createPresentPendingActionTool(ctx).execute({ actionId: action.id });
    expect(found.found).toBe(true);
    expect(found.action?.id).toBe(action.id);
    expect(found.action?.editableFields.length).toBeGreaterThan(0);

    const notFoundForOtherOrg = await createPresentPendingActionTool({
      orgId: otherOrg.id,
      userId: "system",
      role: "owner",
    }).execute({ actionId: action.id });
    expect(notFoundForOtherOrg.found).toBe(false);
  });
});
