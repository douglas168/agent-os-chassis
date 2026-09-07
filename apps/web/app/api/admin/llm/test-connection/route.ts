import { NextResponse } from "next/server";
import { requireAdminContext } from "../../../../../lib/context";

function connectionErrorDetail(err: unknown) {
  if (!(err instanceof Error)) return String(err);
  const cause = "cause" in err ? err.cause : undefined;
  return cause instanceof Error ? `${err.message}: ${cause.message}` : err.message;
}

export async function POST(req: Request) {
  try {
    await requireAdminContext(req.headers);
  } catch {
    return NextResponse.json({ error: "admin role required" }, { status: 403 });
  }

  const baseUrl = process.env.LLM_BASE_URL;
  if (!baseUrl) {
    return NextResponse.json({ ok: false, detail: "LLM_BASE_URL is not set" });
  }

  try {
    const res = await fetch(`${baseUrl}/models`, {
      headers: process.env.LLM_API_KEY ? { Authorization: `Bearer ${process.env.LLM_API_KEY}` } : {},
    });
    return NextResponse.json({
      ok: res.ok,
      detail: res.ok ? `HTTP ${res.status}` : `HTTP ${res.status} ${res.statusText}`,
    });
  } catch (err) {
    return NextResponse.json({
      ok: false,
      detail: connectionErrorDetail(err),
    });
  }
}
