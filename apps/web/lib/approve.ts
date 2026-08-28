import { db, createActionsRepo, createAuditRepo, createRunsRepo, can, type OrgContext } from "@agentos/core";
import { getMastra } from "./mastra";

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
    // Lost the race, or a second request against an action someone already
    // decided — either way, never resume the workflow a second time.
    throw new Error(`action ${actionId} was already decided`);
  }

  const run = await runsRepo.findById(ctx, action.runId);
  if (!run) throw new Error(`no run for id=${action.runId}`);

  const mastra = getMastra();
  const workflowRun = await mastra.getWorkflow(`${run.skillId}-workflow`).createRun({ runId: run.mastraRunId });
  const result = await workflowRun.resume({ step: "draft", resumeData: { approved: decision === "approved" } });

  const runFinalStatus = result.status === "success" ? "done" : "failed";
  await runsRepo.updateStatus(ctx, run.id, runFinalStatus);

  if (decision === "approved") {
    await actionsRepo.markStatus(ctx, actionId, runFinalStatus === "done" ? "done" : "failed");
  }
  // decision === "denied": status stays "denied" — no execute happened (spec § 4.3 pattern: a terminal
  // status is never overwritten by a later step; expiry does the same in Plan 3).

  await auditRepo.record(ctx, {
    actor: ctx.userId, event: `action.${decision}`, entity: "action", entityId: actionId,
    payload: { mastraRunId: run.mastraRunId, result: result.status },
  });

  return { status: decision === "approved" ? runFinalStatus : "denied", actionId };
}
