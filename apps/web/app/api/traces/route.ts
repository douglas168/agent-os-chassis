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
    let traces = await runsRepo.listForOrg(ctx);
    const { searchParams } = new URL(req.url);
    const status = searchParams.get("status");
    const q = searchParams.get("q");
    if (status) traces = traces.filter((r) => r.status === status);
    if (q) {
      const needle = q.toLowerCase();
      traces = traces.filter((r) =>
        r.skillId.toLowerCase().includes(needle) ||
        (r.error?.toLowerCase().includes(needle) ?? false) ||
        (r.failedStep?.toLowerCase().includes(needle) ?? false),
      );
    }
    return NextResponse.json(traces);
  } catch (err) {
    console.error("listForOrg failed:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
