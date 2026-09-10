#!/usr/bin/env bash
# Proves the master spec's "30-minute quickstart" claim against a genuinely
# fresh clone — green tests and code inspection give no signal on this
# (memory: new-required-infra-needs-fresh-env-check). Runs the real
# rename -> install -> compose up -> migrate -> seed path and confirms a
# real Action reaches "pending" before declaring success.
set -euo pipefail

SOURCE="${1:-.}"
SOURCE_ROOT=$(cd "$SOURCE" && pwd)
SCRATCH=$(mktemp -d)
PROJECT="verify-fork-$$"
POSTGRES_PORT="${VERIFY_POSTGRES_PORT:-15433}"
WEB_PORT="${VERIFY_WEB_PORT:-13000}"

cleanup() {
  (cd "$SCRATCH/repo" 2>/dev/null && docker compose -p "$PROJECT" down -v --remove-orphans) 2>/dev/null || true
  rm -rf "$SCRATCH"
}
trap cleanup EXIT

# Keep Docker client/buildx metadata disposable too. Some CI/sandbox runners
# expose the default Docker config read-only, which otherwise makes `--build`
# fail before it can test the cloned project.
DOCKER_CONFIG="$SCRATCH/docker-config"
mkdir -p "$DOCKER_CONFIG"
export DOCKER_CONFIG

START=$(date +%s)

git clone "$SOURCE_ROOT" "$SCRATCH/repo"

# A local git clone checks out HEAD and therefore omits uncommitted changes.
# Overlay the worktree diff for the acceptance run, while still using the
# clone as the test root. Remote sources have no local worktree to overlay.
if git -C "$SOURCE_ROOT" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  git -C "$SOURCE_ROOT" diff --binary HEAD -- . > "$SCRATCH/working-tree.patch"
  if [ -s "$SCRATCH/working-tree.patch" ]; then
    git -C "$SCRATCH/repo" apply "$SCRATCH/working-tree.patch"
  fi
fi

cd "$SCRATCH/repo"

npm install --no-audit --no-fund
npm run rename -- --name demo-fork --display "Demo Fork"
npm install --no-audit --no-fund

cp .env.example .env.local
sed -i.bak "s/localhost:5433/localhost:${POSTGRES_PORT}/g" .env.local && rm .env.local.bak
# The template deliberately leaves this empty; the proof uses a disposable
# value so the auth startup guard is exercised without requiring a real secret.
sed -i.bak 's/^BETTER_AUTH_SECRET=.*/BETTER_AUTH_SECRET=verify-fork-test-secret/' .env.local && rm .env.local.bak

# Postgres only, first — migrate and seed need the schema and data to exist
# BEFORE web/worker start. The worker's first tick fires immediately on
# container start (apps/worker/src/index.ts), so bringing it up before the
# schema exists means its first (and possibly only, if it crashes on the
# missing table) tick fails — a race, not a timing coincidence
# (adversarial-plan-review F4).
POSTGRES_PORT="$POSTGRES_PORT" docker compose -p "$PROJECT" up -d --build postgres

echo "waiting for postgres..."
timeout 60 sh -c "until docker compose -p '$PROJECT' exec -T postgres pg_isready -U demo-fork >/dev/null 2>&1; do sleep 2; done"

npm run db:migrate
npm run seed

POSTGRES_PORT="$POSTGRES_PORT" WEB_PORT="$WEB_PORT" docker compose -p "$PROJECT" up -d --build web worker

echo "waiting for the web container to serve HTTP..."
WEB_DEADLINE=$((SECONDS + 60))
WEB_READY=0
while [ "$SECONDS" -lt "$WEB_DEADLINE" ]; do
  if curl -fsS --max-time 3 "http://localhost:${WEB_PORT}" >/dev/null 2>&1; then
    WEB_READY=1
    break
  fi
  sleep 2
done
if [ "$WEB_READY" -ne 1 ]; then
  echo "verify-fork: FAILED — web did not serve HTTP on http://localhost:${WEB_PORT} after 60s" >&2
  docker compose -p "$PROJECT" ps >&2 || true
  docker compose -p "$PROJECT" logs --tail=30 web >&2 || true
  exit 1
fi
echo "verify-fork: web health check passed — http://localhost:${WEB_PORT} responded"

echo "waiting for the worker's first sweep to draft a pending action..."
# Checks psql's real exit code and validates the output is numeric before
# comparing — the original form (`[ "$OUT" != "0" ]` with stderr suppressed)
# treated a connection failure, an auth error, or a missing table as an
# empty string, which is "not equal to 0" and reads as a false-positive
# success (adversarial-plan-review F12, the single highest-severity finding
# in this review — it made verify-fork.sh structurally unable to catch the
# exact class of failure it exists to catch).
DEADLINE=$((SECONDS + 60))
PENDING_COUNT=""
while [ "$SECONDS" -lt "$DEADLINE" ]; do
  if PENDING_COUNT=$(docker compose -p "$PROJECT" exec -T postgres \
      psql -U demo-fork -d demo-fork -tAc "select count(*) from actions where status='pending'" 2>&1); then
    PENDING_COUNT=$(echo "$PENDING_COUNT" | tr -d '[:space:]')
    if echo "$PENDING_COUNT" | grep -qE '^[0-9]+$' && [ "$PENDING_COUNT" -ge 1 ]; then
      break
    fi
  fi
  sleep 3
done
if ! echo "${PENDING_COUNT:-}" | grep -qE '^[1-9][0-9]*$'; then
  echo "verify-fork: FAILED — no pending action after 60s. Last psql output: ${PENDING_COUNT:-<empty>}" >&2
  exit 1
fi

END=$(date +%s)
echo "verify-fork: OK — demo approval flow proven end to end in $((END - START))s"
