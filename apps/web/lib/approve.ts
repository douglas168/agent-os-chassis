import { db, createActionsRepo, createAuditRepo, createRunsRepo, can, scheduleFollowUpsForAction, declineSkillEntity, type OrgContext } from "@agentos/core";
import { SKILLS } from "@agentos/skills";
import { getMastra } from "./mastra";
import { extractFailedStep } from "./trace-extract";

async function resumeAndFinish(
  ctx: OrgContext, actionId: string, runId: string, mastraRunId: string, skillId: string, resumeDraft: unknown,
  trigger: "approved" | "retried", executingSince: Date,
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
    // finding 3 (Plan 3 final review, closed here): releaseExecuting CAS's
    // on the executingSince this call observed at claim time. If another
    // claimer has since reclaimed the row, this stale attempt's release is a
    // no-op — it must not touch runs/audit either, since the new claimer
    // owns the outcome now.
    const released = await actionsRepo.releaseExecuting(ctx, actionId, executingSince, "failed");
    if (released) {
      await runsRepo.updateStatus(ctx, runId, "failed", { error: (err as Error).message });
      await auditRepo.record(ctx, {
        actor: ctx.userId, event: "action.execute_failed", entity: "action", entityId: actionId,
        payload: { error: (err as Error).message, trigger },
      });
    }
    throw new Error(`action ${actionId} execution failed: ${(err as Error).message}`);
  }

  const { failedStep, failedInput } = extractFailedStep(result);
  const runFinalStatus = result.status === "success" ? "done" : "failed";
  const released = await actionsRepo.releaseExecuting(ctx, actionId, executingSince, runFinalStatus);
  if (!released) {
    // Another claimer's reclaim superseded this attempt's lease between our
    // resume() call and this write — that claimer owns runs/audit now.
    return "superseded";
  }
  await runsRepo.updateStatus(ctx, runId, runFinalStatus, {
    error: result.status === "success" ? null : ((result as any).error?.message ?? null),
    failedStep, failedInput,
  });
  await auditRepo.record(ctx, {
    actor: ctx.userId, event: "action.executed", entity: "action", entityId: actionId,
    payload: { mastraRunId, result: result.status, trigger },
  });
  if (runFinalStatus === "done") {
    const skill = SKILLS.find((s) => s.manifest.id === skillId);
    if (skill) await scheduleFollowUpsForAction(ctx, skill, actionId);
  }

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
    const resumeDraft = action.editedDraft ?? action.draft;
    let result;
    try {
      const workflowRun = await getMastra().getWorkflow(`${action.skillId}-workflow`).createRun({ runId: run.mastraRunId });
      result = await workflowRun.resume({ step: "draft", resumeData: { approved: false, draft: resumeDraft, actionId } });
    } catch (err) {
      await runsRepo.updateStatus(ctx, run.id, "failed", { error: (err as Error).message });
      await auditRepo.record(ctx, {
        actor: ctx.userId, event: "action.execute_failed", entity: "action", entityId: actionId,
        payload: { error: (err as Error).message, trigger: "denied" },
      });
      throw new Error(`action ${actionId} execution failed: ${(err as Error).message}`);
    }
    await runsRepo.updateStatus(ctx, run.id, result.status === "success" ? "done" : "failed");
    await auditRepo.record(ctx, {
      actor: ctx.userId, event: "action.denied", entity: "action", entityId: actionId,
      payload: { mastraRunId: run.mastraRunId },
    });
    await declineSkillEntity(ctx, run);
    return { status: "denied", actionId };
  }

  const claimed = await actionsRepo.transitionStatus(ctx, actionId, "approved", "executing");
  if (!claimed) {
    throw new Error(`action ${actionId} could not be claimed for execution`);
  }

  const resumeDraft = action.editedDraft ?? action.draft;
  // `!`: transitionStatus only returns a row when its CAS UPDATE matched,
  // and that UPDATE just set executingSince — non-null in practice even
  // though the column (and this return type) is nullable (finding 9).
  const status = await resumeAndFinish(ctx, actionId, run.id, run.mastraRunId, action.skillId, resumeDraft, "approved", claimed.executingSince!);
  return { status, actionId };
}

export { resumeAndFinish };

// 10 minutes — long enough to survive a slow but genuinely in-flight
// resumeAndFinish call (echo's mock channel is near-instant, but a real
// channel adapter or a loaded Mastra store could take longer); short
// enough that an operator hitting "retry" on a truly stranded row doesn't
// wait long. LCD10 — not a measured figure, a disclosed policy choice.
const STALE_EXECUTING_MS = 10 * 60 * 1000;

export async function retryAction(ctx: OrgContext, actionId: string) {
  if (!can(ctx.role, { action: ["approve"] })) {
    throw new Error(`role '${ctx.role}' cannot retry actions`);
  }

  const actionsRepo = createActionsRepo(db);
  const runsRepo = createRunsRepo(db);

  const action = await actionsRepo.findById(ctx, actionId);
  if (!action) throw new Error(`no action for id=${actionId}`);

  // finding 15 (reclaim half, sustained): previously only "failed" ->
  // "executing" was claimable, so a row stranded in "executing" by a crash
  // (between this task's own transitionStatus claim, or Task 7's
  // decideAction's approved -> executing claim, and resumeAndFinish
  // completing) had no path back at all.
  const claimed = await actionsRepo.reclaimForRetry(ctx, actionId, STALE_EXECUTING_MS);
  if (!claimed) {
    throw new Error(`action ${actionId} is not in a retryable state`);
  }

  const run = await runsRepo.findById(ctx, action.runId);
  if (!run) throw new Error(`no run for id=${action.runId}`);

  const resumeDraft = action.editedDraft ?? action.draft;
  const status = await resumeAndFinish(ctx, actionId, run.id, run.mastraRunId, action.skillId, resumeDraft, "retried", claimed.executingSince!);
  return { status, actionId };
}
