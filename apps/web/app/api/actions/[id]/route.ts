import { NextResponse } from "next/server";
import { decideAction } from "../../../../lib/approve";

export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json();
  const decision = body.decision === "approved" ? "approved" : "denied";
  const decidedBy = body.decidedBy ?? "operator@example.com";
  const result = await decideAction(id, decision, decidedBy);
  return NextResponse.json(result);
}
