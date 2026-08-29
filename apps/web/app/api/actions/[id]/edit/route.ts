import { NextResponse } from "next/server";
import { applyEdit } from "../../../../../lib/edit";
import { resolveOrgContext } from "../../../../../lib/context";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object" || !("draft" in body)) {
    return NextResponse.json({ error: "body must be { draft: <object> }" }, { status: 400 });
  }

  let ctx;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch (err) {
    console.error("resolveOrgContext failed:", err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await applyEdit(ctx, id, body.draft);
    return NextResponse.json(result);
  } catch (err) {
    const message = (err as Error).message;
    const status = /cannot edit/.test(message) ? 403
      : /no action|no skill/.test(message) ? 404
      : /not pending/.test(message) ? 409
      : /failed validation|non-editable field/.test(message) ? 422
      : null;
    if (status === null) {
      console.error("applyEdit failed:", err);
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status });
  }
}
