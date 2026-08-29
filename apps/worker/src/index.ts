import { sweepExpiredActions, sweepFollowUps } from "@agentos/core";

const intervalMs = Number(process.env.WORKER_SWEEP_INTERVAL_MS ?? 60_000);

async function tick() {
  const expired = await sweepExpiredActions(); const followedUp = await sweepFollowUps();
  console.log(`[worker] sweep: expired=${expired.expired} follow-ups-drafted=${followedUp.drafted}`);
}

tick().catch((err) => console.error("[worker] sweep failed:", err));
setInterval(() => { tick().catch((err) => console.error("[worker] sweep failed:", err)); }, intervalMs);
