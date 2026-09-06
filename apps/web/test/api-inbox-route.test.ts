import { afterAll, afterEach, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { contacts, db, member, messages, organization } from "@agentos/core";
import { GET } from "../app/api/inbox/route";
import { auth } from "../lib/auth";

describe("GET /api/inbox", () => {
  let orgId: string;
  let userId: string;
  let headers: Headers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const user = ctx.test.createUser({ email: "inbox-user@example.com" });
    await ctx.test.saveUser(user);
    userId = user.id;
    const org = await auth.api.createOrganization({
      body: { name: "Inbox Test Org", slug: "inbox-test-org", userId },
    });
    orgId = org!.id;
    headers = await ctx.test.getAuthHeaders({ userId });
  });

  afterEach(async () => {
    await db.delete(messages).where(eq(messages.orgId, orgId));
    await db.delete(contacts).where(eq(contacts.orgId, orgId));
  });

  afterAll(async () => {
    await db.delete(messages).where(eq(messages.orgId, orgId));
    await db.delete(contacts).where(eq(contacts.orgId, orgId));
    await db.delete(member).where(eq(member.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
    const ctx = await auth.$context;
    await ctx.test.deleteUser(userId);
  });

  function makeRequest() {
    return new Request("http://localhost:3000/api/inbox", { headers });
  }

  it("returns inbound messages for the caller's org, including matched and unmatched rows", async () => {
    const contactId = crypto.randomUUID();
    const matchedId = crypto.randomUUID();
    const unmatchedId = crypto.randomUUID();

    await db.insert(contacts).values({
      id: contactId,
      orgId,
      name: "Inbox Contact",
      emails: ["matched@example.com"],
    });
    await db.insert(messages).values([
      {
        id: matchedId,
        orgId,
        channel: "email",
        direction: "in",
        providerMessageId: "inbox-inbound-matched",
        from: "matched@example.com",
        to: "us@example.com",
        subject: "matched",
        body: "hello from a matched contact",
        contactId,
      },
      {
        id: unmatchedId,
        orgId,
        channel: "email",
        direction: "in",
        providerMessageId: "inbox-inbound-unmatched",
        from: "unknown@example.com",
        to: "us@example.com",
        subject: null,
        body: "hello from an unknown contact",
        contactId: null,
      },
    ]);

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(res.status).toBe(200);
    expect(body).toHaveLength(2);
    expect(body).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: matchedId, orgId, direction: "in", contactId }),
      expect.objectContaining({ id: unmatchedId, orgId, direction: "in", contactId: null }),
    ]));
    expect(body.every((message: { orgId: string }) => message.orgId === orgId)).toBe(true);
  });

  it("excludes outbound messages (adversarial review round 1, finding 15)", async () => {
    const outboundId = crypto.randomUUID();
    await db.insert(messages).values({
      id: outboundId,
      orgId,
      channel: "email",
      direction: "out",
      providerMessageId: "inbox-outbound-1",
      from: "us@example.com",
      to: "them@example.com",
      body: "reply",
      contactId: null,
    });

    const res = await GET(makeRequest());
    const body = await res.json();

    expect(body.find((message: { id: string }) => message.id === outboundId)).toBeUndefined();
  });

  it("returns 401 when the caller has no session", async () => {
    const res = await GET(new Request("http://localhost:3000/api/inbox"));
    expect(res.status).toBe(401);
  });
});
