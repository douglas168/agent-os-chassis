import { NextResponse } from "next/server";
import { createAuditRepo, db } from "@agentos/core";
import { resolveOrgContext } from "../../../../lib/context";

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch (err) {
    console.error("resolveOrgContext failed:", err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    return NextResponse.json(await createAuditRepo(db).listForOrg(ctx));
  } catch (err) {
    console.error("list audit history failed:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
