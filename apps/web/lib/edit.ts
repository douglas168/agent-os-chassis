import { db, createActionsRepo, createAuditRepo, can, type OrgContext } from "@agentos/core";
import { SKILLS } from "@agentos/skills";

export async function applyEdit(ctx: OrgContext, actionId: string, editedDraft: unknown) {
  // adversarial-plan-review round 1, finding 7: edit previously had no RBAC
  // check at all — unlike decideAction/redraftAction/retryAction, which all
  // gate on "approve" inside the function itself. Match that pattern here
  // rather than only in the route, so a future second caller can't bypass it.
  if (!can(ctx.role, { action: ["approve"] })) {
    throw new Error(`role '${ctx.role}' cannot edit actions`);
  }

  const actionsRepo = createActionsRepo(db);
  const auditRepo = createAuditRepo(db);

  const action = await actionsRepo.findById(ctx, actionId);
  if (!action) throw new Error(`no action for id=${actionId}`);
  if (action.status !== "pending") throw new Error(`action ${actionId} is not pending, cannot be edited`);

  const skill = SKILLS.find((s) => s.manifest.id === action.skillId);
  if (!skill) throw new Error(`no skill registered for id=${action.skillId}`);

  const parsed = skill.draftSchema.safeParse(editedDraft);
  if (!parsed.success) {
    throw new Error(`edited draft failed validation: ${parsed.error.message}`);
  }

  const changedPaths = Object.keys(parsed.data as object).filter(
    (key) => JSON.stringify((parsed.data as any)[key]) !== JSON.stringify((action.draft as any)[key]),
  );

  // finding 7 (second half): applyEdit computed changedPaths but never
  // checked them against skill.editableFields — any authenticated role could
  // silently change `to`, which draft.ts's own comment already documents as
  // not editable.
  const disallowed = changedPaths.filter((key) => !skill.editableFields.includes(key));
  if (disallowed.length > 0) {
    throw new Error(`edit touches non-editable field(s): ${disallowed.join(", ")}`);
  }

  const updated = await actionsRepo.setEditedDraft(ctx, actionId, parsed.data);
  await auditRepo.record(ctx, {
    actor: ctx.userId, event: "action.edited", entity: "action", entityId: actionId,
    payload: { changedPaths },
  });

  return updated;
}
