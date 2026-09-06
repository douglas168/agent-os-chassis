import { NextResponse } from "next/server";
import { db, createRunsRepo } from "@agentos/core";
import { resolveOrgContext } from "../../../lib/context";

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch (err) {
    console.error("resolveOrgContext failed:", err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const runsRepo = createRunsRepo(db);
    const runs = await runsRepo.listForOrg(ctx);
    return NextResponse.json(runs);
  } catch (err) {
    console.error("listForOrg failed:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
