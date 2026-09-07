import { NextResponse } from "next/server";
import { buildChatAgent } from "@agentos/core";
import { resolveOrgContext } from "../../../lib/context";

type ChatMessageInput = { role: "user" | "assistant"; content: string };

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch (err) {
    console.error("resolveOrgContext failed:", err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const body = await req.json().catch(() => null);
  const messages = Array.isArray(body?.messages) ? body.messages : null;
  const hasValidMessages =
    messages !== null &&
    messages.length > 0 &&
    messages.every((message: unknown): message is ChatMessageInput => {
      if (!message || typeof message !== "object") return false;
      const candidate = message as Record<string, unknown>;
      return (candidate.role === "user" || candidate.role === "assistant")
        && typeof candidate.content === "string"
        && candidate.content.trim() !== "";
    });
  if (!hasValidMessages) {
    return NextResponse.json({ error: "messages is required" }, { status: 400 });
  }

  const agent = buildChatAgent(ctx);
  const result = await agent.generate(messages);
  const toolCalls = (result.toolCalls ?? []).map((call: any) => {
    const resultChunk = (result.toolResults ?? []).find(
      (candidate: any) => candidate.payload.toolCallId === call.payload.toolCallId,
    );
    return {
      toolCallId: call.payload.toolCallId,
      toolName: call.payload.toolName,
      args: call.payload.args ?? {},
      result: resultChunk?.payload.result,
      isError: resultChunk?.payload.isError ?? false,
    };
  });

  return NextResponse.json({
    role: "assistant",
    content: result.text,
    toolCalls,
  });
}
