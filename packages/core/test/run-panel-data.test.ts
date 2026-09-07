import { afterEach, describe, expect, it } from "vitest";
import { db } from "../src/db/client";
import { actions, messages, organization, runs } from "../src/db/schema";
import { createRunsRepo } from "../src/repositories/runs";
import { runSkillForMessage } from "../src/engine/run-skill";
import { toRunPanelData } from "../src/engine/run-panel-data";
import { echoSkill } from "@agentos/skills";

describe("toRunPanelData", () => {
  afterEach(async () => {
    await db.delete(actions);
    await db.delete(runs);
    await db.delete(messages);
    await db.delete(organization);
  });

  it("maps a real run to conversation/trace/stats, org-scoped", async () => {
    const [org] = await db.insert(organization)
      .values({
        id: crypto.randomUUID(),
        name: "Run Panel Data Org",
        slug: `run-panel-data-${crypto.randomUUID()}`,
        createdAt: new Date(),
      })
      .returning();
    const ctx = { orgId: org.id, userId: "system", role: "owner" };
    const [message] = await db.insert(messages).values({
      orgId: org.id,
      channel: "mock",
      direction: "in",
      providerMessageId: `rpd-${crypto.randomUUID()}`,
      from: "a@example.com",
      to: "b@example.com",
      body: "hello there",
    }).returning();

    const { runId } = await runSkillForMessage(
      ctx,
      echoSkill,
      {
        channel: "mock",
        from: "a@example.com",
        to: "b@example.com",
        body: "hello there",
      } as any,
      message.id,
    );
    const runRow = await createRunsRepo(db).findByMastraRunId(ctx, runId);

    const data = await toRunPanelData(ctx, runRow!.id);
    expect(data?.conversation.some((turn) => turn.role === "inbound" && turn.text === "hello there")).toBe(true);
    expect(data?.stats?.turns).toBeNull();
    expect(data?.stats?.steps).toBeGreaterThan(0);
    expect(data?.trace.some((row) => row.label === "understand")).toBe(true);

    const otherOrgCtx = { orgId: crypto.randomUUID(), userId: "system", role: "owner" };
    const notFound = await toRunPanelData(otherOrgCtx, runRow!.id);
    expect(notFound).toBeNull();
  });
});
