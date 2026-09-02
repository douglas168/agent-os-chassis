import { sweepExpiredActions, sweepFollowUps, sweepArReminderCron } from "@agentos/core";

const intervalMs = Number(process.env.WORKER_SWEEP_INTERVAL_MS ?? 60_000);

// finding 3 (adversarial review round 1): a slow tick (many overdue
// invoices, a slow DB round-trip) can still be running when setInterval
// fires the next one — both would read the same "issued" invoice before
// either's stage flip lands, double-triggering it. This process-local
// guard skips an overlapping tick instead of letting two run concurrently;
// it only needs to hold within this one worker process (spec § 3's
// single-worker-process design, already assumed by cron-sweep.ts).
let tickInFlight = false;

async function tick() {
  if (tickInFlight) {
    console.log("[worker] sweep skipped — previous tick still in flight");
    return;
  }
  tickInFlight = true;
  try {
    const expired = await sweepExpiredActions();
    const followedUp = await sweepFollowUps();
    const cron = await sweepArReminderCron();
    console.log(`[worker] sweep: expired=${expired.expired} follow-ups-drafted=${followedUp.drafted} cron-triggered=${cron.triggered}`);
  } finally {
    tickInFlight = false;
  }
}

tick().catch((err) => console.error("[worker] sweep failed:", err));
setInterval(() => { tick().catch((err) => console.error("[worker] sweep failed:", err)); }, intervalMs);
