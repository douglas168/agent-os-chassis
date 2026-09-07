import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { organization, runs, messages, actions } from "../src/db/schema";
import { runSkillForMessage } from "../src/engine/run-skill";
import { echoSkill } from "@agentos/skills";

describe("runSkillForMessage writes runs.stats", () => {
  // runSkillForMessage always creates an actions row (actions.runId references
  // runs.id, no cascade) — deleting runs first would throw Postgres 23503.
  afterEach(async () => {
    await db.delete(actions);
    await db.delete(runs);
    await db.delete(messages);
    await db.delete(organization);
  });

  it("writes a real steps/wallClockMs; turns stays null since echoSkill makes no LLM call", async () => {
    const [org] = await db.insert(organization).values({ id: crypto.randomUUID(), name: "Run Stats Org", slug: `run-stats-${crypto.randomUUID()}`, createdAt: new Date() }).returning();
    const ctx = { orgId: org.id, userId: "system", role: "owner" };
    const [message] = await db.insert(messages).values({
      orgId: org.id, channel: "mock", direction: "in", providerMessageId: `stats-${crypto.randomUUID()}`,
      from: "a@example.com", to: "b@example.com", body: "hello there",
    }).returning();

    const { runId } = await runSkillForMessage(ctx, echoSkill, { channel: "mock", from: "a@example.com", to: "b@example.com", body: "hello there" } as any, message.id);

    const [row] = await db.select().from(runs).where(eq(runs.mastraRunId, runId));
    expect(row.stats).not.toBeNull();
    const stats = row.stats as { turns: number | null; steps: number; wallClockMs: number };
    expect(stats.turns).toBeNull();
    expect(stats.steps).toBeGreaterThan(0);
    expect(stats.wallClockMs).toBeGreaterThanOrEqual(0);
  });

  it("writes runs.intent from skill.understand()'s real return", async () => {
    const [org] = await db.insert(organization).values({ id: crypto.randomUUID(), name: "Run Intent Org", slug: `run-intent-${crypto.randomUUID()}`, createdAt: new Date() }).returning();
    const ctx = { orgId: org.id, userId: "system", role: "owner" };
    const [message] = await db.insert(messages).values({
      orgId: org.id, channel: "mock", direction: "in", providerMessageId: `intent-${crypto.randomUUID()}`,
      from: "a@example.com", to: "b@example.com", body: "hello there",
    }).returning();

    const { runId } = await runSkillForMessage(ctx, echoSkill, { channel: "mock", from: "a@example.com", to: "b@example.com", body: "hello there" } as any, message.id);

    const [row] = await db.select().from(runs).where(eq(runs.mastraRunId, runId));
    expect(row.intent).toEqual({ text: "hello there" });
  });
});
