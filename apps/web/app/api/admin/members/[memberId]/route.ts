import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { requireAdminContext } from "../../../../../lib/context";

function adminRequiredResponse() {
  return NextResponse.json({ error: "admin role required" }, { status: 403 });
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  let ctx;
  try {
    ctx = await requireAdminContext(req.headers);
  } catch {
    return adminRequiredResponse();
  }

  const { memberId } = await params;
  const body = await req.json();
  const { role } = body as { role?: unknown };
  if (typeof role !== "string") {
    return NextResponse.json({ error: "role is required" }, { status: 400 });
  }

  const updated = await auth.api.updateMemberRole({
    headers: req.headers,
    body: { memberId, role, organizationId: ctx.orgId },
  });
  return NextResponse.json(updated);
}

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ memberId: string }> },
) {
  let ctx;
  try {
    ctx = await requireAdminContext(req.headers);
  } catch {
    return adminRequiredResponse();
  }

  const { memberId } = await params;
  await auth.api.removeMember({
    headers: req.headers,
    body: { memberIdOrEmail: memberId, organizationId: ctx.orgId },
  });
  return NextResponse.json({ ok: true });
}
