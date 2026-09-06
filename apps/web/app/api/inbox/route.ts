import { NextResponse } from "next/server";
import { db, createMessagesRepo } from "@agentos/core";
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
    const rows = await createMessagesRepo(db).listForOrg(ctx);
    const inbound = rows.filter((message) => message.direction === "in");
    return NextResponse.json(inbound);
  } catch (err) {
    console.error("listForOrg failed:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
