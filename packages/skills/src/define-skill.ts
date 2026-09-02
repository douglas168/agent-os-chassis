import { createStep, createWorkflow } from "@mastra/core/workflows";
import { z } from "zod";
import type { Skill } from "./contract";

const messageSchema = z.object({
  channel: z.string(), direction: z.literal("in"),
  from: z.string(), to: z.string(), subject: z.string().optional(),
  body: z.string(), providerMessageId: z.string(), raw: z.unknown(),
});

export function defineSkill<Intent, Draft>(skill: Skill<Intent, Draft>) {
  const understandStep = createStep({
    id: "understand",
    inputSchema: z.object({ message: messageSchema, intent: skill.intentSchema.optional(), draft: skill.draftSchema.optional() }),
    outputSchema: z.object({ intent: skill.intentSchema, message: messageSchema, draft: skill.draftSchema.optional() }),
    execute: async ({ inputData }) => {
      // LCD4 (ingest half): honor a precomputed intent from the caller
      // (run-skill.ts) instead of recomputing — mirrors the resume path's
      // existing resumeData short-circuit on draftStep below.
      const intent = inputData.intent ?? await skill.understand(inputData.message as any);
      return { intent, message: inputData.message, draft: inputData.draft };
    },
  });

  const draftStep = createStep({
    id: "draft",
    inputSchema: z.object({ intent: skill.intentSchema, message: messageSchema, draft: skill.draftSchema.optional() }),
    outputSchema: z.object({ approved: z.boolean(), draft: z.any(), actionId: z.string().optional() }),
    resumeSchema: z.object({ approved: z.boolean(), draft: z.any(), actionId: z.string() }),
    suspendSchema: z.object({ draft: z.any() }),
    execute: async ({ inputData, resumeData, suspend }) => {
      if (!resumeData) {
        const draft = inputData.draft ?? await skill.draft(inputData.intent as any, inputData.message as any);
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
    retries: 2,
    execute: async ({ inputData }) => {
      if (!inputData.approved) return { ok: false };
      if (!inputData.actionId) {
        throw new Error("execute step reached with no idempotency key — resume() was called outside resumeAndFinish");
      }
      // LCD6: hardcoded mock channel, carried forward unchanged — no plan
      // through M1 adds a real ChannelAdapter (spec § 10's own demo is
      // itself mock-send).
      const { createMockChannel } = await import("@agentos/channels");
      const channel = createMockChannel();
      const result = await skill.execute(inputData.draft, channel, { idempotencyKey: inputData.actionId });
      // finding 12 (adversarial review round 1): a business-logic send
      // failure (ok: false) must fail the Mastra step, not just this
      // step's own output field — resumeAndFinish reads result.status
      // ("success" | "failed") to decide "done" vs "failed" and whether
      // Task 5 schedules follow-ups. Returning { ok: false } here looked
      // like success to everything downstream.
      // Note: `retries: 2` above will now retry a permanent send failure
      // exactly like a transient one — createMockChannel() never actually
      // fails through M1 (LCD6), so this tradeoff has no live consequence
      // yet; a real ChannelAdapter should distinguish retryable from
      // permanent failures when one is added.
      if (!result.ok) {
        throw new Error(`skill execute() reported a failed send (idempotencyKey=${inputData.actionId})`);
      }
      return { ok: true };
    },
  });

  return createWorkflow({
    id: `${skill.manifest.id}-workflow`,
    inputSchema: z.object({ message: messageSchema, intent: skill.intentSchema.optional(), draft: skill.draftSchema.optional() }),
    outputSchema: z.object({ ok: z.boolean() }),
  })
    .then(understandStep as any)
    .then(draftStep as any)
    .then(executeStep as any)
    .commit();
}
