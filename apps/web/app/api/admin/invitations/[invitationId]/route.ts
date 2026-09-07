import { NextResponse } from "next/server";
import { auth } from "../../../../../lib/auth";
import { requireAdminContext } from "../../../../../lib/context";

export async function DELETE(
  req: Request,
  { params }: { params: Promise<{ invitationId: string }> },
) {
  try {
    await requireAdminContext(req.headers);
  } catch {
    return NextResponse.json({ error: "admin role required" }, { status: 403 });
  }

  const { invitationId } = await params;
  await auth.api.cancelInvitation({
    headers: req.headers,
    body: { invitationId },
  });
  return NextResponse.json({ ok: true });
}
