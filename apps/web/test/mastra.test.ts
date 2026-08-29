import { describe, it, expect } from "vitest";
import { getMastra } from "../lib/mastra";

describe("echo workflow (Mastra, Postgres-backed)", () => {
  it("suspends after draft, then resumes to success with approved:true", async () => {
    const mastra = getMastra();
    const run = await mastra.getWorkflow("echo-workflow").createRun();

    const started = await run.start({
      inputData: {
        message: {
          channel: "mock", direction: "in", from: "customer@example.com", to: "ops@example.com",
          subject: "Hi", body: "Hello there", providerMessageId: "p1", raw: {},
        },
      },
    });
    expect(started.status).toBe("suspended");

    const resumed = await run.resume({
      step: "draft",
      resumeData: {
        approved: true,
        draft: { kind: "reply", to: "customer@example.com", subject: "Re: Hi", body: "You said: Hello there" },
        actionId: "test-action-id",
      },
    });
    expect(resumed.status).toBe("success");
  });

  it("resuming with a draft in resumeData is what the workflow carries through, not a recomputed draft", async () => {
    const mastra = getMastra();
    const run = await mastra.getWorkflow("echo-workflow").createRun();

    const started = await run.start({
      inputData: {
        message: {
          channel: "mock", direction: "in", from: "customer@example.com", to: "ops@example.com",
          subject: "Hi", body: "Hello there", providerMessageId: "p-edit-mastra-1", raw: {},
        },
      },
    });
    expect(started.status).toBe("suspended");

    const editedDraft = { kind: "reply", to: "customer@example.com", subject: "Re: Hi (edited)", body: "Edited body, not the original" };
    // actionId is now required on resumeSchema (Task 6, LCD10 / finding 15) — a
    // dummy value stands in for a real action row here; this test only checks
    // the draft carries through unedited, not the idempotency-key wiring
    // itself (packages/skills/test/echo.test.ts covers that).
    const resumed = await run.resume({ step: "draft", resumeData: { approved: true, draft: editedDraft, actionId: "test-action-id" } });

    expect(resumed.status).toBe("success");
    expect((resumed.steps as any).draft.output.draft).toEqual(editedDraft);
  });
});
