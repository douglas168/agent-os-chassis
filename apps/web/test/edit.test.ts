import { describe, it, expect, beforeAll, afterEach, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization, messages, runs, actions, auditLog } from "@agentos/core";
import { matchAndRun } from "../lib/router";
import { applyEdit } from "../lib/edit";

describe("applyEdit", () => {
  let orgId: string;
  const ctx = () => ({ orgId, userId: "operator@example.com", role: "owner" });

  beforeAll(async () => {
    const [org] = await db.insert(organization)
      .values({ id: crypto.randomUUID(), name: "Edit Test Org", slug: "edit-test-org", createdAt: new Date() })
      .returning();
    orgId = org.id;
  });
  afterEach(async () => {
    await db.delete(auditLog); await db.delete(actions); await db.delete(runs); await db.delete(messages);
  });
  afterAll(async () => { await db.delete(organization).where(eq(organization.id, orgId)); });

  it("persists a schema-valid edit and records the changed field paths", async () => {
    const { actionId } = await matchAndRun({
      from: "customer@example.com", to: "ops@example.com", subject: "Hi", body: "Hello there", providerMessageId: "p-edit-1",
    });

    const edited = { kind: "reply", to: "customer@example.com", subject: "Re: Hi", body: "A different, edited body" };
    await applyEdit(ctx(), actionId, edited);

    const [action] = await db.select().from(actions).where(eq(actions.id, actionId));
    expect(action.editedDraft).toEqual(edited);

    const [entry] = await db.select().from(auditLog).where(eq(auditLog.entityId, actionId));
    expect(entry.event).toBe("action.edited");
    expect((entry.payload as any).changedPaths).toEqual(["body"]);
  });

  it("rejects an edit that doesn't match the skill's draft schema", async () => {
    const { actionId } = await matchAndRun({
      from: "customer2@example.com", to: "ops@example.com", subject: "Hi", body: "Another message", providerMessageId: "p-edit-2",
    });

    await expect(applyEdit(ctx(), actionId, { kind: "reply", body: "missing to/subject" }))
      .rejects.toThrow(/failed validation/i);
  });

  it("refuses an edit from a role without approve permission", async () => {
    const { actionId } = await matchAndRun({
      from: "customer3@example.com", to: "ops@example.com", subject: "Hi", body: "Third message", providerMessageId: "p-edit-3",
    });
    const viewerCtx = { orgId, userId: "viewer@example.com", role: "viewer" };

    await expect(applyEdit(viewerCtx, actionId, { kind: "reply", to: "customer3@example.com", subject: "Re: Hi", body: "Edited" }))
      .rejects.toThrow(/cannot edit/i);
  });

  it("rejects an edit that touches a non-editable field", async () => {
    const { actionId } = await matchAndRun({
      from: "customer4@example.com", to: "ops@example.com", subject: "Hi", body: "Fourth message", providerMessageId: "p-edit-4",
    });

    await expect(
      applyEdit(ctx(), actionId, { kind: "reply", to: "attacker@example.com", subject: "Re: Hi", body: "Hello there" }),
    ).rejects.toThrow(/non-editable field/i);
  });
});
