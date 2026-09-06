import { NextResponse } from "next/server";
import { db, createActionsRepo, createFollowUpsRepo } from "@agentos/core";
import { resolveOrgContext } from "../../../lib/context";

const WEEK_MS = 7 * 24 * 60 * 60 * 1000;

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch (err) {
    console.error("resolveOrgContext failed:", err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const actionsRepo = createActionsRepo(db);
  const [pending, thisWeek, followUpsDue, approved, denied, expired] = await Promise.all([
    actionsRepo.listPending(ctx),
    actionsRepo.listSince(ctx, new Date(Date.now() - WEEK_MS)),
    createFollowUpsRepo(db).countDueForOrg(ctx),
    actionsRepo.listByStatus(ctx, "approved"),
    actionsRepo.listByStatus(ctx, "denied"),
    actionsRepo.listByStatus(ctx, "expired"),
  ]);

  return NextResponse.json({
    pendingApprovals: pending.length,
    actionsThisWeek: thisWeek.length,
    followUpsDue,
    actionsExpired: expired.length,
    outcomes: { approved: approved.length, denied: denied.length },
  });
}
