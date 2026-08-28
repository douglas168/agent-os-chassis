import { NextResponse } from "next/server";
import { db, createActionsRepo } from "@agentos/core";
import { resolveOrgContext } from "../../../lib/context";

export async function GET(req: Request) {
  const ctx = await resolveOrgContext(req.headers);
  const actionsRepo = createActionsRepo(db);
  const pending = await actionsRepo.listPending(ctx);
  return NextResponse.json(pending);
}
