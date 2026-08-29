import { describe, it, expect } from "vitest";
import { extractFailedStep } from "../lib/trace-extract";

describe("extractFailedStep", () => {
  it("returns null/null for a successful result", () => {
    const result = { status: "success", steps: { draft: { status: "success" }, execute: { status: "success" } } };
    expect(extractFailedStep(result as any)).toEqual({ failedStep: null, failedInput: null });
  });

  it("finds the failed step's id and best-effort input from a failed result", () => {
    const result = {
      status: "failed",
      steps: {
        draft: { status: "success" },
        execute: { status: "failed", error: new Error("boom"), payload: { draft: { body: "hi" } } },
      },
    };
    const extracted = extractFailedStep(result as any);
    expect(extracted.failedStep).toBe("execute");
    expect(extracted.failedInput).toEqual({ draft: { body: "hi" } });
  });

  it("never throws when a failed step has no payload field at all", () => {
    const result = { status: "failed", steps: { execute: { status: "failed", error: new Error("boom") } } };
    expect(() => extractFailedStep(result as any)).not.toThrow();
    expect(extractFailedStep(result as any).failedInput).toBeNull();
  });
});
