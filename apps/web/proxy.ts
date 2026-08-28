import { NextRequest, NextResponse } from "next/server";
import { auth } from "./lib/auth";

export async function proxy(request: NextRequest) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    // No sign-in page exists yet (Plan 5 UI depth) — see this plan's
    // Least-confident decisions #4 for why this is a 401, not a redirect.
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  return NextResponse.next();
}

export const config = {
  runtime: "nodejs",
  matcher: ["/approvals/:path*", "/api/actions/:path*"],
};
