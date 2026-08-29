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
  outputSchema: z.object({ approved: z.boolean(), draft: z.any() }),
  resumeSchema: z.object({ approved: z.boolean() }),
  suspendSchema: z.object({ draft: z.any() }),
  execute: async ({ inputData, resumeData, suspend }) => {
    const draft = await echoSkill.draft(inputData.intent as any, inputData.message as any);
    if (!resumeData) {
      await suspend({ draft });
      return { approved: false, draft };
    }
    return { approved: resumeData.approved, draft };
  },
});

const executeStep = createStep({
  id: "execute",
  inputSchema: z.object({ approved: z.boolean(), draft: z.any() }),
  outputSchema: z.object({ ok: z.boolean() }),
  execute: async ({ inputData }) => {
    if (!inputData.approved) return { ok: false };
    // Task 8 swaps this for the org's registered ChannelAdapter; Task 5 proves the workflow shape.
    const { createMockChannel } = await import("@agentos/channels");
    const channel = createMockChannel();
    const result = await echoSkill.execute(inputData.draft, channel);
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
