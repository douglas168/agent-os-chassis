import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, user } from "@agentos/core";
import { resolveOrgContext } from "../../../lib/context";

const SUPPORTED_LOCALES = ["en", "zh-TW"] as const;

export async function PATCH(req: Request) {
  let ctx;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch (err) {
    console.error("resolveOrgContext failed:", err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  if (!SUPPORTED_LOCALES.includes(body?.locale)) {
    return NextResponse.json({ error: `locale must be one of ${SUPPORTED_LOCALES.join(", ")}` }, { status: 400 });
  }

  await db.update(user).set({ locale: body.locale }).where(eq(user.id, ctx.userId));
  return NextResponse.json({ locale: body.locale });
}
