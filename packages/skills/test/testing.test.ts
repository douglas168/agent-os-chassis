import { describe, it, expect } from "vitest";
import { echoSkill } from "../src/echo";
import { fixtureMessage, runSkillLoop } from "../src/testing";

describe("skill test harness", () => {
  it("fixtureMessage() produces a valid InboundMessage with overridable fields", () => {
    const message = fixtureMessage({ body: "custom body" });
    expect(message.channel).toBe("mock");
    expect(message.body).toBe("custom body");
    expect(message.providerMessageId).toMatch(/^p-/);
  });

  it("runSkillLoop() drives a skill's full understand -> draft -> execute path against the mock channel", async () => {
    const message = fixtureMessage({ body: "Hello there" });
    const { intent, draft, result, sentMessages } = await runSkillLoop(echoSkill, message);
    expect(intent).toEqual({ text: "Hello there" });
    expect(draft).toMatchObject({ kind: "reply", body: "You said: Hello there" });
    expect(result.ok).toBe(true);
    expect(sentMessages).toHaveLength(1);
  });
});
