import { NextResponse } from "next/server";
import { db, createActionsRepo } from "@agentos/core";
import { SKILLS } from "@agentos/skills";
import { resolveOrgContext } from "../../../lib/context";

export async function GET(req: Request) {
  const ctx = await resolveOrgContext(req.headers);
  const actionsRepo = createActionsRepo(db);
  const { searchParams } = new URL(req.url);
  const status = searchParams.get("status") ?? "pending";
  const rows = status === "pending"
    ? await actionsRepo.listPending(ctx)
    : await actionsRepo.listByStatus(ctx, status);
  const withEditableFields = rows.map((action) => ({
    ...action,
    editableFields: SKILLS.find((skill) => skill.manifest.id === action.skillId)?.editableFields ?? [],
  }));
  return NextResponse.json(withEditableFields);
}
