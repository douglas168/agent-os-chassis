import { describe, it, expect } from "vitest";
import { Mastra } from "@mastra/core";
import { PostgresStore } from "@mastra/pg";
import { z } from "zod";
import { defineSkill } from "../src/define-skill";
import type { Skill } from "../src/contract";
import type { InboundMessage } from "@agentos/channels";

const PingIntentSchema = z.object({ n: z.number() });
const PingDraftSchema = z.object({ kind: z.literal("ping"), to: z.string(), body: z.string() });

const pingSkill: Skill<z.infer<typeof PingIntentSchema>, z.infer<typeof PingDraftSchema>> = {
  manifest: { id: "ping", name: "Ping", description: "test-only skill proving defineSkill() generalizes beyond echo", approvalExpiryHours: 1 },
  trigger: { kind: "message", matches: () => false },
  understand: async (message: InboundMessage) => ({ n: message.body.length }),
  draft: async (intent, message: InboundMessage) => ({ kind: "ping" as const, to: message.from, body: `len=${intent.n}` }),
  execute: async (approvedDraft, channel, opts) => channel.send({ to: approvedDraft.to, body: approvedDraft.body, idempotencyKey: opts.idempotencyKey }),
  intentSchema: PingIntentSchema, draftSchema: PingDraftSchema, editableFields: ["body"],
};

describe("defineSkill()", () => {
  it("builds a runnable Mastra workflow from a Skill definition that is not echo", async () => {
    const workflow = defineSkill(pingSkill);
    const mastra = new Mastra({
      workflows: { "ping-workflow": workflow },
      storage: new PostgresStore({ id: "define-skill-test-store", connectionString: process.env.DATABASE_URL! }),
    });

    const run = await mastra.getWorkflow("ping-workflow").createRun();
    const started = await run.start({
      inputData: { message: { channel: "mock", direction: "in", from: "customer@example.com", to: "ops@example.com", body: "hello", providerMessageId: "p-ping-1", raw: {} } },
    });
    expect(started.status).toBe("suspended");

    const resumed = await run.resume({
      step: "draft",
      resumeData: { approved: true, draft: { kind: "ping", to: "customer@example.com", body: "len=5" }, actionId: "test-ping-action" },
    });
    expect(resumed.status).toBe("success");
  });
});
