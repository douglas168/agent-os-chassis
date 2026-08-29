import { NextResponse } from "next/server";
import { redraftAction } from "../../../../../lib/redraft";
import { resolveOrgContext } from "../../../../../lib/context";
import { can } from "@agentos/core";

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;

  let ctx;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch (err) {
    console.error("resolveOrgContext failed:", err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  if (!can(ctx.role, { action: ["approve"] })) {
    return NextResponse.json({ error: `role '${ctx.role}' cannot redraft actions` }, { status: 403 });
  }

  try {
    const result = await redraftAction(ctx, id);
    return NextResponse.json(result);
  } catch (err) {
    const message = (err as Error).message;
    const status = /no action|no .*message|no skill/.test(message) ? 404
      : /not expired/.test(message) ? 409
      : null;
    if (status === null) {
      console.error("redraftAction failed:", err);
      return NextResponse.json({ error: "internal error" }, { status: 500 });
    }
    return NextResponse.json({ error: message }, { status });
  }
}
