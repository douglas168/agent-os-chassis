import { Mastra } from "@mastra/core";
import { createWorkflow, createStep } from "@mastra/core/workflows";
import { PostgresStore } from "@mastra/pg";
import { z } from "zod";
import { echoSkill } from "@agentos/skills";

const messageSchema = z.object({
  channel: z.string(), direction: z.literal("in"),
  from: z.string(), to: z.string(), subject: z.string().optional(),
  body: z.string(), providerMessageId: z.string(), raw: z.unknown(),
});

const understandStep = createStep({
  id: "understand",
  inputSchema: z.object({ message: messageSchema }),
  outputSchema: z.object({ intent: z.object({ text: z.string() }), message: messageSchema }),
  execute: async ({ inputData }) => {
    const intent = await echoSkill.understand(inputData.message as any);
    return { intent, message: inputData.message };
  },
});

const draftStep = createStep({
  id: "draft",
  inputSchema: z.object({ intent: z.object({ text: z.string() }), message: messageSchema }),
  outputSchema: z.object({ approved: z.boolean(), draft: z.any(), actionId: z.string().optional() }),
  resumeSchema: z.object({ approved: z.boolean(), draft: z.any(), actionId: z.string() }),
  suspendSchema: z.object({ draft: z.any() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    if (!resumeData) {
      const draft = await echoSkill.draft(inputData.intent as any, inputData.message as any);
      await suspend({ draft });
      return { approved: false, draft };
    }
    return { approved: resumeData.approved, draft: resumeData.draft, actionId: resumeData.actionId };
  },
});

const executeStep = createStep({
  id: "execute",
  inputSchema: z.object({ approved: z.boolean(), draft: z.any(), actionId: z.string().optional() }),
  outputSchema: z.object({ ok: z.boolean() }),
  // Spec § 4: "every step has retry-with-backoff (Mastra step retries)" —
  // verified option, context7 /mastra-ai/mastra "Configure step-level retries".
  retries: 2,
  execute: async ({ inputData }) => {
    if (!inputData.approved) return { ok: false };
    // A missing actionId here means resume() was called outside
    // resumeAndFinish (the only production caller) — fail loud rather than
    // silently sending with no idempotency key.
    if (!inputData.actionId) {
      throw new Error("execute step reached with no idempotency key — resume() was called outside resumeAndFinish");
    }
    // Task 8 swaps this for the org's registered ChannelAdapter; Task 5 proves the workflow shape.
    const { createMockChannel } = await import("@agentos/channels");
    const channel = createMockChannel();
    // Mastra's mock adapter does not itself dedupe on this key — it just
    // records whatever it is given (packages/channels/src/mock.ts). This
    // satisfies spec § 4 step 6's literal requirement (the key is generated
    // and carried to the channel boundary); real crash-safe dedupe at that
    // boundary needs a real channel adapter to implement it, which this plan
    // does not add (LCD9).
    const result = await echoSkill.execute(inputData.draft, channel, { idempotencyKey: inputData.actionId });
    return { ok: result.ok };
  },
});

const echoWorkflow = createWorkflow({
  id: "echo-workflow",
  inputSchema: z.object({ message: messageSchema }),
  outputSchema: z.object({ ok: z.boolean() }),
})
  .then(understandStep)
  .then(draftStep)
  .then(executeStep)
  .commit();

let mastra: Mastra | undefined;

export function getMastra(): Mastra {
  if (mastra) return mastra;
  const storage = new PostgresStore({ id: "agentos-store", connectionString: process.env.DATABASE_URL! });
  mastra = new Mastra({ workflows: { "echo-workflow": echoWorkflow }, storage });
  return mastra;
}
