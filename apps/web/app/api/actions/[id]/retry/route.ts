import { NextResponse } from "next/server";
import { retryAction } from "../../../../../lib/approve";
import { resolveOrgContext } from "../../../../../lib/context";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let ctx;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch (err) {
    console.error("resolveOrgContext failed:", err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const result = await retryAction(ctx, id);
    return NextResponse.json(result);
  } catch (err) {
    const message = (err as Error).message;
    const status = /no action|no run/.test(message) ? 404
      : /cannot retry/.test(message) ? 403
      : /not in a retryable state/.test(message) ? 409
      : null;
    if (status === null) {
      console.error("retryAction failed:", err);
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status });
  }
}
