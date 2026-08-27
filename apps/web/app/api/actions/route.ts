import { NextResponse } from "next/server";
import { db, resolveOrgContext, createActionsRepo } from "@agentos/core";

export async function GET() {
  const ctx = await resolveOrgContext();
  const actionsRepo = createActionsRepo(db);
  const pending = await actionsRepo.listPending(ctx);
  return NextResponse.json(pending);
}
