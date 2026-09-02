import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { contacts } from "../db/schema";
import { createRunsRepo } from "../repositories/runs";
import { SKILLS, skillArInvoices } from "@agentos/skills";
import type { OrgContext } from "../context";

// One entry today — the second skill-owned table is what would justify
// generalizing this into a dynamic registry (Least-confident decision #3).
const ENTITY_TABLES: Record<string, typeof skillArInvoices> = { skill_ar_invoices: skillArInvoices };

export async function loadEntityView(ctx: OrgContext, entityId: string) {
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
    const [contact] = contactId ? await db.select().from(contacts).where(and(eq(contacts.id, contactId), eq(contacts.orgId, ctx.orgId))) : [];

    const presented = skill.entity.present({ ...row, contactName: contact?.name });
    const runsRepo = createRunsRepo(db);
    const runs = await runsRepo.findForEntity(ctx, { table: skill.entity.table, id: entityId });

    return { ...presented, id: entityId, skillId: skill.manifest.id, stages: skill.entity.stages, runs };
  }
  return null;
}
