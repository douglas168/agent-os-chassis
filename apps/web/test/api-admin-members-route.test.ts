import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { eq } from "drizzle-orm";
import { db, organization, member as memberTable } from "@agentos/core";
import { auth } from "../lib/auth";
import { GET as listMembers, POST as inviteMember } from "../app/api/admin/members/route";
import { PATCH as updateRole, DELETE as removeMember } from "../app/api/admin/members/[memberId]/route";
import { DELETE as cancelInvitation } from "../app/api/admin/invitations/[invitationId]/route";

describe("/api/admin/members", () => {
  let ownerHeaders: Headers;
  let operatorHeaders: Headers;
  let orgId: string;
  let ownerId: string;
  let operatorId: string;
  let operatorMemberId: string;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const test = ctx.test;
    const owner = test.createUser({ email: "admin-users-owner@example.com" });
    await test.saveUser(owner);
    ownerId = owner.id;

    const org = await auth.api.createOrganization({
      body: {
        name: "Admin Users Org",
        slug: `admin-users-${crypto.randomUUID()}`,
        userId: ownerId,
      },
    });
    orgId = org!.id;
    ownerHeaders = await test.getAuthHeaders({ userId: ownerId });

    const operator = test.createUser({ email: "admin-users-operator@example.com" });
    await test.saveUser(operator);
    operatorId = operator.id;
    const createdMember = await auth.api.addMember({
      body: { organizationId: orgId, userId: operatorId, role: "operator" },
    });
    operatorMemberId = createdMember!.id;
    operatorHeaders = await test.getAuthHeaders({ userId: operatorId });
  });

  afterAll(async () => {
    await db.delete(memberTable).where(eq(memberTable.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
    await (await auth.$context).test.deleteUser(ownerId);
    await (await auth.$context).test.deleteUser(operatorId);
  });

  it("lets an owner list members, but returns 403 to an operator", async () => {
    const asOwner = await listMembers(
      new Request("http://localhost/api/admin/members", { headers: ownerHeaders }),
    );
    expect(asOwner.status).toBe(200);
    const body = await asOwner.json();
    expect(body.members.length).toBeGreaterThanOrEqual(2);

    const asOperator = await listMembers(
      new Request("http://localhost/api/admin/members", { headers: operatorHeaders }),
    );
    expect(asOperator.status).toBe(403);
  });

  it("lets an owner change another member's role, but returns 403 to an operator", async () => {
    const asOperator = await updateRole(
      new Request("http://localhost/api/admin/members/x", {
        method: "PATCH",
        headers: operatorHeaders,
        body: JSON.stringify({ role: "admin" }),
      }),
      { params: Promise.resolve({ memberId: operatorMemberId }) },
    );
    expect(asOperator.status).toBe(403);

    const operatorRemoveAttempt = await removeMember(
      new Request("http://localhost/api/admin/members/x", {
        method: "DELETE",
        headers: operatorHeaders,
      }),
      { params: Promise.resolve({ memberId: operatorMemberId }) },
    );
    expect(operatorRemoveAttempt.status).toBe(403);

    const asOwner = await updateRole(
      new Request("http://localhost/api/admin/members/x", {
        method: "PATCH",
        headers: ownerHeaders,
        body: JSON.stringify({ role: "admin" }),
      }),
      { params: Promise.resolve({ memberId: operatorMemberId }) },
    );
    expect(asOwner.status).toBe(200);
    const updated = await asOwner.json();
    expect(updated.role).toBe("admin");
  });

  it("lets an owner remove a member", async () => {
    const asOwner = await removeMember(
      new Request("http://localhost/api/admin/members/x", {
        method: "DELETE",
        headers: ownerHeaders,
      }),
      { params: Promise.resolve({ memberId: operatorMemberId }) },
    );
    expect(asOwner.status).toBe(200);
  });

  it("lets an owner invite a new member, but returns 403 to an operator", async () => {
    const asOperator = await inviteMember(new Request("http://localhost/api/admin/members", {
      method: "POST",
      headers: operatorHeaders,
      body: JSON.stringify({ email: "hijack@example.com", role: "admin" }),
    }));
    expect(asOperator.status).toBe(403);

    const asOwner = await inviteMember(new Request("http://localhost/api/admin/members", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ email: `invitee-${crypto.randomUUID()}@example.com`, role: "operator" }),
    }));
    expect(asOwner.status).toBe(201);
    const invitation = await asOwner.json();
    expect(invitation.role).toBe("operator");

    const list = await listMembers(
      new Request("http://localhost/api/admin/members", { headers: ownerHeaders }),
    );
    const listed = await list.json();
    expect(listed.invitations.some((i: { id: string }) => i.id === invitation.id)).toBe(true);
  });

  it("lets an owner cancel a pending invitation, but returns 403 to an operator", async () => {
    const created = await inviteMember(new Request("http://localhost/api/admin/members", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ email: `cancel-${crypto.randomUUID()}@example.com`, role: "operator" }),
    }));
    const invitation = await created.json();

    const asOperator = await cancelInvitation(
      new Request(`http://localhost/api/admin/invitations/${invitation.id}`, {
        method: "DELETE",
        headers: operatorHeaders,
      }),
      { params: Promise.resolve({ invitationId: invitation.id }) },
    );
    expect(asOperator.status).toBe(403);

    const asOwner = await cancelInvitation(
      new Request(`http://localhost/api/admin/invitations/${invitation.id}`, {
        method: "DELETE",
        headers: ownerHeaders,
      }),
      { params: Promise.resolve({ invitationId: invitation.id }) },
    );
    expect(asOwner.status).toBe(200);
  });
});
