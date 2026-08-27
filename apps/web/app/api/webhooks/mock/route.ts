import { NextResponse } from "next/server";
import { matchAndRun } from "../../../../lib/router";

export async function POST(req: Request) {
  const payload = await req.json();
  const result = await matchAndRun(payload);
  return NextResponse.json(result);
}
