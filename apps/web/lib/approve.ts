import { db, createActionsRepo, createAuditRepo, createRunsRepo, can, type OrgContext } from "@agentos/core";
import { getMastra } from "./mastra";
import { extractFailedStep } from "./trace-extract";

async function resumeAndFinish(
  ctx: OrgContext, actionId: string, runId: string, mastraRunId: string, skillId: string, resumeDraft: unknown,
): Promise<string> {
  const runsRepo = createRunsRepo(db);
  const actionsRepo = createActionsRepo(db);
  const auditRepo = createAuditRepo(db);

  const mastra = getMastra();
  let result;
  try {
    const workflowRun = await mastra.getWorkflow(`${skillId}-workflow`).createRun({ runId: mastraRunId });
    // actionId doubles as the execute-boundary idempotency key (finding 15,
    // spec § 4 step 6) — required on draftStep's resumeSchema (Task 6), so
    // every real resume (this function is the only production caller) must
    // supply it.
    result = await workflowRun.resume({ step: "draft", resumeData: { approved: true, draft: resumeDraft, actionId } });
  } catch (err) {
    // F34 (Plan 2 final review): resume() threw before Mastra recorded any
    // terminal result. Without this catch, the action stays "executing"
    // forever with no audit row and no way to retry (actions.decide only
    // fires from "pending", and transitionStatus's claim already consumed
    // "approved"). Task 8's retryAction is what re-attempts from here.
    await actionsRepo.markStatus(ctx, actionId, "failed");
    await runsRepo.updateStatus(ctx, runId, "failed", { error: (err as Error).message });
    await auditRepo.record(ctx, {
      actor: ctx.userId, event: "action.execute_failed", entity: "action", entityId: actionId,
      payload: { error: (err as Error).message },
    });
    throw new Error(`action ${actionId} execution failed: ${(err as Error).message}`);
  }

  const { failedStep, failedInput } = extractFailedStep(result);
  const runFinalStatus = result.status === "success" ? "done" : "failed";
  await runsRepo.updateStatus(ctx, runId, runFinalStatus, {
    error: result.status === "success" ? null : ((result as any).error?.message ?? null),
    failedStep, failedInput,
  });
  await actionsRepo.markStatus(ctx, actionId, runFinalStatus);
  await auditRepo.record(ctx, {
    actor: ctx.userId, event: "action.executed", entity: "action", entityId: actionId,
    payload: { mastraRunId, result: result.status },
  });

  return runFinalStatus;
}

export async function decideAction(ctx: OrgContext, actionId: string, decision: "approved" | "denied") {
  const permission = decision === "approved" ? "approve" : "deny";
  if (!can(ctx.role, { action: [permission] })) {
    throw new Error(`role '${ctx.role}' cannot ${permission} actions`);
  }

  const actionsRepo = createActionsRepo(db);
  const runsRepo = createRunsRepo(db);
  const auditRepo = createAuditRepo(db);

  const action = await actionsRepo.findById(ctx, actionId);
  if (!action) throw new Error(`no action for id=${actionId}`);

  const decided = await actionsRepo.decide(ctx, actionId, decision, ctx.userId);
  if (!decided) {
    throw new Error(`action ${actionId} was already decided`);
  }

  const run = await runsRepo.findById(ctx, action.runId);
  if (!run) throw new Error(`no run for id=${action.runId}`);

  if (decision === "denied") {
    const workflowRun = await getMastra().getWorkflow(`${action.skillId}-workflow`).createRun({ runId: run.mastraRunId });
    const resumeDraft = action.editedDraft ?? action.draft;
    const result = await workflowRun.resume({ step: "draft", resumeData: { approved: false, draft: resumeDraft, actionId } });
    await runsRepo.updateStatus(ctx, run.id, result.status === "success" ? "done" : "failed");
    await auditRepo.record(ctx, {
      actor: ctx.userId, event: "action.denied", entity: "action", entityId: actionId,
      payload: { mastraRunId: run.mastraRunId },
    });
    return { status: "denied", actionId };
  }

  const claimed = await actionsRepo.transitionStatus(ctx, actionId, "approved", "executing");
  if (!claimed) {
    throw new Error(`action ${actionId} could not be claimed for execution`);
  }

  const resumeDraft = action.editedDraft ?? action.draft;
  const status = await resumeAndFinish(ctx, actionId, run.id, run.mastraRunId, action.skillId, resumeDraft);
  return { status, actionId };
}

export { resumeAndFinish };
