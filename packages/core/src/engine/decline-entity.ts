import { and, eq } from "drizzle-orm";
import { db } from "../db/client";
import { skillArInvoices } from "@agentos/skills";

// Demo-specific coupling, matching cron-sweep.ts's own disclosed pattern
// (that file already imports skillArInvoices from @agentos/skills — core
// importing skills is the allowed direction; skills must never import
// core). A denied or expired action's run may carry an entityRef pointing
// at a skill-owned record (spec § 8.1). This is the only terminal-state
// write path back to that record — without it a denied/expired AR reminder
// leaves its invoice stuck at "issued" forever, silently re-drafted by the
// cron sweep on every tick (final review N1, Gate B Option B, 2026-09-02).
// Generalizing this to arbitrary skill-owned tables via a skill-contract
// hook is out of scope for M1 — ar-reminder is the only skill with an
// entityRef-linked table through this milestone.
export async function declineSkillEntity(
  ctx: { orgId: string },
  run: { entityRef: unknown } | null | undefined,
): Promise<void> {
  const ref = run?.entityRef as { table?: string; id?: string } | null;
  if (ref?.table !== "skill_ar_invoices" || !ref.id) return;
  await db.update(skillArInvoices).set({ stage: "declined", updatedAt: new Date() })
    .where(and(eq(skillArInvoices.id, ref.id), eq(skillArInvoices.orgId, ctx.orgId)));
}
