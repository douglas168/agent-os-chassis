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

    const resumed = await run.resume({ step: "draft", resumeData: { approved: true } });
    expect(resumed.status).toBe("success");
  });
});
