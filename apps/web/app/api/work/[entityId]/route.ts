import { NextResponse } from "next/server";
import { loadEntityView } from "@agentos/core";
import { resolveOrgContext } from "../../../../lib/context";

export async function GET(req: Request, { params }: { params: Promise<{ entityId: string }> }) {
  let ctx;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch (err) {
    console.error("resolveOrgContext failed:", err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { entityId } = await params;
  let view: Awaited<ReturnType<typeof loadEntityView>>;
  try {
    view = await loadEntityView(ctx, entityId);
  } catch (err) {
    console.error("loadEntityView failed:", err);
    return NextResponse.json({ error: "invalid entity id" }, { status: 400 });
  }
  if (!view) return NextResponse.json({ error: "not found" }, { status: 404 });
  return NextResponse.json(view);
}
