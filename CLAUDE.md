# agent-os-chassis — forkable agentic OS starter template

> A forkable agentic OS starter template. Clone it, run `scripts/rename.ts` (see FORKING.md), and build your own agent product on top. See README.md to get started.

milestone-tracking: disabled
tdd: enabled
constitution: disabled
codex-network: enabled
factory: pending

## Rules

- No OSS enters this repo without license verification: dependency licenses are checked in CI (`.github/workflows/ci.yml`) via `license-checker-rseidelsohn`, against an explicit allow list in that file.
- Every domain table carries an `org_id` column, and every repository helper scopes its queries by it — this is how this template keeps one Postgres database safely shared across multiple tenant organizations.
