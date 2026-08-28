import { NextResponse } from "next/server";
import { decideAction } from "../../../../lib/approve";
import { resolveOrgContext } from "../../../../lib/context";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (body?.decision !== "approved" && body?.decision !== "denied") {
    return NextResponse.json({ error: "decision must be 'approved' or 'denied'" }, { status: 400 });
  }

  let ctx;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch (err) {
    console.error("resolveOrgContext failed:", err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await decideAction(ctx, id, body.decision);
    return NextResponse.json(result);
  } catch (err) {
    const message = (err as Error).message;
    const status = /no action|no run/.test(message) ? 404
      : /cannot (approve|deny)/.test(message) ? 403
      : /already decided/.test(message) ? 409
      : null;
    if (status === null) {
      console.error("decideAction failed:", err);
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status });
  }
}
