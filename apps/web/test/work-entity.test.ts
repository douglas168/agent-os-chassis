import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization, member, contacts, messages, runs, actions, auditLog, sweepArReminderCron } from "@agentos/core";
// finding 14: skillArInvoices is a @agentos/skills export, never
// re-exported through @agentos/core.
import { skillArInvoices } from "@agentos/skills";
import { GET } from "../app/api/work/[entityId]/route";
import { auth } from "../lib/auth";

describe("GET /api/work/[entityId]", () => {
  let orgId: string, createdUserId: string, invoiceId: string;

  beforeAll(async () => {
    const ctx2 = await auth.$context;
    const test = ctx2.test;
    const user = test.createUser({ email: "work-entity-user@example.com" });
    await test.saveUser(user);
    createdUserId = user.id;
    const org = await auth.api.createOrganization({ body: { name: "Work Entity Test Org", slug: "work-entity-test-org", userId: user.id } });
    orgId = org!.id;

    const [contact] = await db.insert(contacts)
      .values({ id: crypto.randomUUID(), orgId, name: "Work Entity Customer", emails: ["work-entity-customer@example.com"] })
      .returning();
    const [invoice] = await db.insert(skillArInvoices)
      .values({ id: crypto.randomUUID(), orgId, contactId: contact.id, invoiceNumber: "INV-WE-1", amountCents: 5000, dueAt: new Date(Date.now() - 24 * 60 * 60 * 1000), stage: "issued" })
      .returning();
    invoiceId = invoice.id;
    await sweepArReminderCron();
  });

  afterAll(async () => {
    // finding 5 (adversarial review round 1): scope every delete to this
    // test's own orgId — an unscoped delete on a shared dev/test DB clears
    // rows other suites or a concurrent seed run left behind.
    await db.delete(auditLog).where(eq(auditLog.orgId, orgId));
    await db.delete(actions).where(eq(actions.orgId, orgId));
    await db.delete(runs).where(eq(runs.orgId, orgId));
    await db.delete(messages).where(eq(messages.orgId, orgId));
    await db.delete(skillArInvoices).where(eq(skillArInvoices.orgId, orgId));
    await db.delete(contacts).where(eq(contacts.orgId, orgId));
    await db.delete(member).where(eq(member.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
    const ctx2 = await auth.$context;
    await ctx2.test.deleteUser(createdUserId);
  });

  it("returns the invoice's fields, stage stepper, and the real run touching it — not a test double", async () => {
    const headers = await (await auth.$context).test.getAuthHeaders({ userId: createdUserId });
    const req = new Request(`http://localhost:3000/api/work/${invoiceId}`, { headers });
    const res = await GET(req, { params: Promise.resolve({ entityId: invoiceId }) });
    const json = await res.json();

    expect(json.title).toBe("Invoice INV-WE-1");
    expect(json.subtitle).toBe("Work Entity Customer");
    expect(json.currentStage).toBe("reminded");
    expect(json.stages.map((s: any) => s.key)).toEqual(["issued", "due", "reminded", "escalated", "paid", "declined"]);
    expect(json.runs).toHaveLength(1);
    expect(json.runs[0].skillId).toBe("ar-reminder");
  });

  it("returns 404 for an id no skill's entity view resolves", async () => {
    const headers = await (await auth.$context).test.getAuthHeaders({ userId: createdUserId });
    const missingId = crypto.randomUUID();
    const req = new Request(`http://localhost:3000/api/work/${missingId}`, { headers });
    const res = await GET(req, { params: Promise.resolve({ entityId: missingId }) });
    expect(res.status).toBe(404);
  });

  it("returns 400 with a JSON error for a malformed entity id", async () => {
    const headers = await (await auth.$context).test.getAuthHeaders({ userId: createdUserId });
    const malformedId = "not-a-uuid";
    const req = new Request(`http://localhost:3000/api/work/${malformedId}`, { headers });
    const res = await GET(req, { params: Promise.resolve({ entityId: malformedId }) });
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toMatchObject({ error: "invalid entity id" });
  });

  it("returns 401 when the caller has no session", async () => {
    const req = new Request(`http://localhost:3000/api/work/${invoiceId}`);
    const res = await GET(req, { params: Promise.resolve({ entityId: invoiceId }) });
    expect(res.status).toBe(401);
  });
});
