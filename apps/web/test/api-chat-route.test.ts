import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { db, member, organization } from "@agentos/core";
import { auth } from "../lib/auth";

const { mockGenerate } = vi.hoisted(() => ({ mockGenerate: vi.fn() }));

vi.mock("@agentos/core", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@agentos/core")>();
  return {
    ...actual,
    buildChatAgent: () => ({ generate: mockGenerate }),
  };
});

describe("POST /api/chat", () => {
  let orgId: string;
  let ownerId: string;
  let ownerHeaders: Headers;

  beforeAll(async () => {
    mockGenerate.mockResolvedValue({ text: "stubbed reply", toolCalls: [], toolResults: [] });
    const ctx = await auth.$context;
    const test = ctx.test;
    const owner = test.createUser({ email: "chat-route-owner@example.com" });
    await test.saveUser(owner);
    ownerId = owner.id;
    const org = await auth.api.createOrganization({
      body: {
        name: "Chat Route Org",
        slug: `chat-route-${crypto.randomUUID()}`,
        userId: ownerId,
      },
    });
    orgId = org!.id;
    ownerHeaders = await test.getAuthHeaders({ userId: ownerId });
  });

  afterAll(async () => {
    await db.delete(member).where(eq(member.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
    await (await auth.$context).test.deleteUser(ownerId);
  });

  it("401s an unauthenticated caller", async () => {
    const { POST } = await import("../app/api/chat/route");
    const res = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      body: JSON.stringify({ messages: [{ role: "user", content: "hi" }] }),
    }));
    expect(res.status).toBe(401);
  });

  it("400s a missing messages array", async () => {
    const { POST } = await import("../app/api/chat/route");
    const res = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({}),
    }));
    expect(res.status).toBe(400);
  });

  it("returns the agent's reply for a valid message history", async () => {
    const { POST } = await import("../app/api/chat/route");
    const history = [
      { role: "user" as const, content: "hi" },
      { role: "assistant" as const, content: "hello" },
      { role: "user" as const, content: "again" },
    ];
    const res = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ messages: history }),
    }));
    const body = await res.json();
    expect(body).toEqual({ role: "assistant", content: "stubbed reply", toolCalls: [] });
    expect(mockGenerate).toHaveBeenCalledWith(history);
  });

  it("surfaces a tool call and its result for the tool UIs", async () => {
    mockGenerate.mockResolvedValueOnce({
      text: "",
      toolCalls: [{
        type: "tool-call",
        runId: "r1",
        from: "AGENT",
        payload: {
          toolCallId: "call-1",
          toolName: "runSkill",
          args: { skillId: "echo", message: "hi" },
        },
      }],
      toolResults: [{
        type: "tool-result",
        runId: "r1",
        from: "AGENT",
        payload: {
          toolCallId: "call-1",
          toolName: "runSkill",
          result: { ok: true, runId: "run-db-id", actionId: "action-1" },
          isError: false,
        },
      }],
    });
    const { POST } = await import("../app/api/chat/route");
    const res = await POST(new Request("http://localhost/api/chat", {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({ messages: [{ role: "user", content: "run echo" }] }),
    }));
    const body = await res.json();
    expect(body.toolCalls).toEqual([{
      toolCallId: "call-1",
      toolName: "runSkill",
      args: { skillId: "echo", message: "hi" },
      result: { ok: true, runId: "run-db-id", actionId: "action-1" },
      isError: false,
    }]);
  });
});
