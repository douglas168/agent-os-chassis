import { NextResponse } from "next/server";
import { decideAction } from "../../../../lib/approve";

export async function PATCH(req: Request, { params }: { params: { id: string } }) {
  const body = await req.json();
  const decision = body.decision === "approved" ? "approved" : "denied";
  const decidedBy = body.decidedBy ?? "operator@example.com";
  const result = await decideAction(params.id, decision, decidedBy);
  return NextResponse.json(result);
}
