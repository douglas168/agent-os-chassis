import { NextResponse } from "next/server";
import { requireAdminContext } from "../../../../lib/context";

export async function GET(req: Request) {
  try {
    await requireAdminContext(req.headers);
  } catch {
    return NextResponse.json({ error: "admin role required" }, { status: 403 });
  }

  return NextResponse.json({
    baseUrl: process.env.LLM_BASE_URL ?? null,
    model: process.env.LLM_MODEL ?? null,
    apiKeyConfigured: Boolean(process.env.LLM_API_KEY),
  });
}
