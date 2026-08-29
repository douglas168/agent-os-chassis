// stepResult.status / stepResult.error are confirmed fields (context7,
// /mastra-ai/mastra, error-handling.mdx "Access individual step results").
// stepResult.payload is not confirmed against this version's exported
// StepResult type — read defensively (Least-confident decision #5).
export function extractFailedStep(result: { status: string; steps?: Record<string, any> }): {
  failedStep: string | null;
  failedInput: unknown;
} {
  if (result.status === "success" || !result.steps) {
    return { failedStep: null, failedInput: null };
  }
  const entry = Object.entries(result.steps).find(([, s]) => s?.status === "failed");
  if (!entry) return { failedStep: null, failedInput: null };
  const [stepId, stepResult] = entry;
  return { failedStep: stepId, failedInput: (stepResult as any).payload ?? null };
}
