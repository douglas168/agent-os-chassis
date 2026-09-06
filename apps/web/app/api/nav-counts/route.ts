import { NextResponse } from "next/server";
import {
  db,
  createActionsRepo,
  createFollowUpsRepo,
  createMessagesRepo,
  type OrgContext,
} from "@agentos/core";
import { resolveOrgContext } from "../../../lib/context";

export async function GET(req: Request) {
  let ctx: OrgContext;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch (err) {
    console.error("resolveOrgContext failed:", err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const [pending, due, unmatched] = await Promise.all([
    createActionsRepo(db).listPending(ctx),
    createFollowUpsRepo(db).countDueForOrg(ctx),
    createMessagesRepo(db).countUnmatched(ctx),
  ]);
  return NextResponse.json({ approvals: pending.length, jobs: due, inbox: unmatched });
}
