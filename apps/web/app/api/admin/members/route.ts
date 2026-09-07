import { NextResponse } from "next/server";
import { orgRoles } from "@agentos/core";
import { auth } from "../../../../lib/auth";
import { requireAdminContext } from "../../../../lib/context";

type OrgRole = keyof typeof orgRoles;

function isOrgRole(value: unknown): value is OrgRole {
  return typeof value === "string" && Object.prototype.hasOwnProperty.call(orgRoles, value);
}

function adminRequiredResponse() {
  return NextResponse.json({ error: "admin role required" }, { status: 403 });
}

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await requireAdminContext(req.headers);
  } catch {
    return adminRequiredResponse();
  }

  const [members, invitations] = await Promise.all([
    auth.api.listMembers({
      headers: req.headers,
      query: { organizationId: ctx.orgId },
    }),
    auth.api.listInvitations({
      headers: req.headers,
      query: { organizationId: ctx.orgId },
    }),
  ]);

  return NextResponse.json({ members: members.members, invitations });
}

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await requireAdminContext(req.headers);
  } catch {
    return adminRequiredResponse();
  }

  const body = await req.json();
  const { email, role } = body as { email?: unknown; role?: unknown };
  if (typeof email !== "string" || !isOrgRole(role)) {
    return NextResponse.json({ error: "email and role are required" }, { status: 400 });
  }

  const invitation = await auth.api.createInvitation({
    headers: req.headers,
    body: { email, role, organizationId: ctx.orgId },
  });
  return NextResponse.json(invitation, { status: 201 });
}
