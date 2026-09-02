import type { SkillTrigger } from "../contract";

// Cron-triggered, not message-triggered (Least-confident decision #3): no
// real cron-expression parser, a daily worker-tick check. The actual
// "which invoices are overdue" query lives in
// packages/core/src/engine/cron-sweep.ts, which safely imports this
// skill's schema table — this file only declares the trigger shape.
export const trigger: SkillTrigger = { kind: "cron", intervalMs: 24 * 60 * 60 * 1000 };
