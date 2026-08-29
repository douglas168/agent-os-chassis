import { NextResponse } from "next/server";
import { db, createRunsRepo } from "@agentos/core";
import { resolveOrgContext } from "../../../lib/context";

export async function GET(req: Request) {
  const ctx = await resolveOrgContext(req.headers);
  const runsRepo = createRunsRepo(db);
  const traces = await runsRepo.listForOrg(ctx);
  return NextResponse.json(traces);
}
