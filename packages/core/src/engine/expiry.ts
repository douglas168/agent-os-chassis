import { and, eq, lt } from "drizzle-orm";
import { db } from "../db/client";
import { actions } from "../db/schema";
import { createAuditRepo } from "../repositories/audit";

export async function sweepExpiredActions(): Promise<{ expired: number }> {
  const now = new Date();
  const rows = await db.update(actions)
    .set({ status: "expired" })
    .where(and(eq(actions.status, "pending"), lt(actions.expiresAt, now)))
    .returning();

  const auditRepo = createAuditRepo(db);
  // The bulk update claims each row through the pending-status predicate. Keep
  // audit failures isolated because an already-expired action must not prevent
  // later claimed rows from receiving their audit entry.
  for (const row of rows) {
    try {
      // Background sweeps have no request session, so use the system actor.
      await auditRepo.record({ orgId: row.orgId, userId: "system", role: "system" }, {
        actor: "system", event: "action.expired", entity: "action", entityId: row.id, payload: {},
      });
    } catch (err) {
      console.error(`[expiry-sweep] audit write failed for action ${row.id} (already expired):`, err);
    }
  }

  return { expired: rows.length };
}
