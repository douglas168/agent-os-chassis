import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, organization } from "@agentos/core";
import { auth } from "../../../../lib/auth";
import { requireAdminContext } from "../../../../lib/context";

function adminRequiredResponse() {
  return NextResponse.json({ error: "admin role required" }, { status: 403 });
}

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await requireAdminContext(req.headers);
  } catch {
    return adminRequiredResponse();
  }

  const [row] = await db
    .select({ name: organization.name, locale: organization.locale })
    .from(organization)
    .where(eq(organization.id, ctx.orgId));

  // Channel credentials are intentionally env-only in v1. Expose presence,
  // never the credential value itself.
  const channels = {
    email: Boolean(process.env.EMAIL_API_KEY),
    line: Boolean(process.env.LINE_CHANNEL_ACCESS_TOKEN),
  };

  return NextResponse.json({ ...row, channels });
}

export async function PATCH(req: Request) {
  let ctx;
  try {
    ctx = await requireAdminContext(req.headers);
  } catch {
    return adminRequiredResponse();
  }

  const { name, locale } = await req.json();
  await auth.api.updateOrganization({
    headers: req.headers,
    body: {
      organizationId: ctx.orgId,
      data: {
        ...(name ? { name } : {}),
        ...(locale ? { locale } : {}),
      },
    },
  });

  return NextResponse.json({ ok: true });
}
