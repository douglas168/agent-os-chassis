import { and, eq, sql } from "drizzle-orm";
import { db } from "../db/client";
import { contacts, documents } from "../db/schema";
import { createActionsRepo } from "../repositories/actions";
import { createRunsRepo } from "../repositories/runs";
import { SKILLS, skillArInvoices, type EntityViewData } from "@agentos/skills";
import type { OrgContext } from "../context";

// One entry today — the second skill-owned table is what would justify
// generalizing this into a dynamic registry (Least-confident decision #3).
const ENTITY_TABLES: Record<string, typeof skillArInvoices> = { skill_ar_invoices: skillArInvoices };

export async function loadEntityView(ctx: OrgContext, entityId: string): Promise<EntityViewData | null> {
  for (const skill of SKILLS) {
    if (!skill.entity) continue;
    const table = ENTITY_TABLES[skill.entity.table];
    if (!table) continue;

    const [row] = await db.select().from(table).where(eq(table.id, entityId));
    if (!row || (row as any).orgId !== ctx.orgId) continue;

    // finding 15 (adversarial review round 1): org-scope the contact
    // lookup — an id-only WHERE lets one org's entity resolve to another
    // org's contact row, leaking that contact's name into this response.
    const contactId = (row as any).contactId as string | undefined;
    const [contactRow] = contactId
      ? await db.select().from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.orgId, ctx.orgId)))
      : [];

    const docs = await db.select().from(documents).where(
      and(
        eq(documents.orgId, ctx.orgId),
        sql`${documents.entityRef} @> ${JSON.stringify({ table: skill.entity.table, id: entityId })}::jsonb`,
      ),
    );

    const presented = skill.entity.present({ ...row, contactName: contactRow?.name });
    const runsRepo = createRunsRepo(db);
    const entityRuns = await runsRepo.findForEntity(ctx, { table: skill.entity.table, id: entityId });
    const rawPendingActions = await createActionsRepo(db).listPendingForRunIds(ctx, entityRuns.map((run) => run.id));
    const pendingActions = rawPendingActions.map((action) => ({
      id: action.id,
      runId: action.runId,
      skillId: action.skillId,
      draft: action.draft as Record<string, unknown>,
      editedDraft: action.editedDraft as Record<string, unknown> | null,
      status: action.status,
      expiresAt: action.expiresAt.toISOString(),
      editableFields: [
        ...(SKILLS.find((candidate) => candidate.manifest.id === action.skillId)?.editableFields ?? []),
      ],
    }));

    return {
      ...presented,
      id: entityId,
      skillId: skill.manifest.id,
      stages: skill.entity.stages,
      runs: entityRuns,
      contact: contactRow
        ? { id: contactRow.id, name: contactRow.name, company: contactRow.company }
        : null,
      documents: docs.map((document) => ({
        id: document.id,
        title: document.title,
        mime: document.mime,
        sizeBytes: document.sizeBytes,
      })),
      pendingActions,
    };
  }
  return null;
}
