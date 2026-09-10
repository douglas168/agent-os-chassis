#!/usr/bin/env bash
# Proves the README's literal local-development path against a fresh clone:
# root env file -> postgres only -> migrate -> seed -> both npm dev commands.
# This is intentionally separate from verify-fork.sh, which proves the Docker
# production path.
set -euo pipefail

SOURCE="${1:-.}"
SOURCE_ROOT=$(cd "$SOURCE" && pwd)
SCRATCH=$(mktemp -d)
PROJECT="verify-dev-mode-$$"
POSTGRES_PORT="${VERIFY_DEV_POSTGRES_PORT:-15434}"
WEB_PORT="${VERIFY_DEV_WEB_PORT:-13001}"
WEB_PID=""
WORKER_PID=""

cleanup() {
  set +e
  if [ -n "$WEB_PID" ]; then
    kill -- -"$WEB_PID" 2>/dev/null || kill "$WEB_PID" 2>/dev/null || true
  fi
  if [ -n "$WORKER_PID" ]; then
    kill -- -"$WORKER_PID" 2>/dev/null || kill "$WORKER_PID" 2>/dev/null || true
  fi
  (cd "$SCRATCH/repo" 2>/dev/null && docker compose -p "$PROJECT" down -v --remove-orphans) 2>/dev/null || true
  rm -rf "$SCRATCH"
}
trap cleanup EXIT

# Keep Docker client/buildx metadata disposable, matching verify-fork.sh.
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
  for env_link in apps/web/.env apps/web/.env.local; do
    if [ -L "$SOURCE_ROOT/$env_link" ]; then
      ln -s "$(readlink "$SOURCE_ROOT/$env_link")" "$SCRATCH/repo/$env_link"
    fi
  done
fi

cd "$SCRATCH/repo"

npm install --no-audit --no-fund

cp .env.example .env.local
sed -i.bak "s/localhost:5433/localhost:${POSTGRES_PORT}/g" .env.local && rm .env.local.bak
# The template deliberately leaves this empty; this disposable value lets
# the local-dev proof reach the seeded auth code without using a real secret.
sed -i.bak 's/^BETTER_AUTH_SECRET=.*/BETTER_AUTH_SECRET=verify-dev-mode-test-secret/' .env.local && rm .env.local.bak

echo "starting postgres only and waiting for its healthcheck..."
POSTGRES_PORT="$POSTGRES_PORT" docker compose -p "$PROJECT" up -d --wait postgres

npm run db:migrate
npm run seed

DATABASE_URL=$(sed -n 's/^DATABASE_URL=//p' .env.local | head -1)
if [ -z "$DATABASE_URL" ]; then
  echo "verify-dev-mode: FAILED — DATABASE_URL is missing from .env.local" >&2
  exit 1
fi
export DATABASE_URL

WEB_LOG="$SCRATCH/web.log"
WORKER_LOG="$SCRATCH/worker.log"
echo "starting README dev commands (web port ${WEB_PORT})..."
PORT="$WEB_PORT" setsid npm run dev --workspace=@agentos/web >"$WEB_LOG" 2>&1 &
WEB_PID=$!
setsid npm run dev --workspace=@agentos/worker >"$WORKER_LOG" 2>&1 &
WORKER_PID=$!

echo "waiting for the local web process to serve HTTP..."
WEB_DEADLINE=$((SECONDS + 90))
WEB_READY=0
while [ "$SECONDS" -lt "$WEB_DEADLINE" ]; do
  if curl -fsS --max-time 3 "http://localhost:${WEB_PORT}" >/dev/null 2>&1; then
    WEB_READY=1
    break
  fi
  if ! kill -0 "$WEB_PID" 2>/dev/null; then
    break
  fi
  sleep 2
done
if [ "$WEB_READY" -ne 1 ]; then
  echo "verify-dev-mode: FAILED — web dev process did not serve HTTP on http://localhost:${WEB_PORT}" >&2
  echo "--- web log ---" >&2
  tail -30 "$WEB_LOG" >&2 || true
  exit 1
fi
echo "verify-dev-mode: web dev health check passed — http://localhost:${WEB_PORT} responded"

pending_count() {
  if command -v psql >/dev/null 2>&1; then
    psql "$DATABASE_URL" -tAc "select count(*) from actions where status='pending'"
  else
    # Keep the check a direct host connection when the PostgreSQL client is
    # not installed; npm install already provides the same pg driver used by
    # the application. CI and developer machines with psql use the branch
    # above.
    node --input-type=module -e '
      import { Client } from "pg";
      const client = new Client({ connectionString: process.env.DATABASE_URL });
      await client.connect();
      try {
        const result = await client.query("select count(*) from actions where status=\x27pending\x27");
        console.log(result.rows[0].count);
      } finally {
        await client.end();
      }
    '
  fi
}

if command -v psql >/dev/null 2>&1; then
  echo "checking pending Action through local Postgres with psql..."
else
  echo "psql is unavailable; checking pending Action through the direct local pg connection..."
fi

echo "waiting for the worker's first sweep to draft a pending action..."
DEADLINE=$((SECONDS + 90))
PENDING_COUNT=""
LAST_DB_OUTPUT=""
while [ "$SECONDS" -lt "$DEADLINE" ]; do
  if PENDING_COUNT=$(pending_count 2>&1); then
    PENDING_COUNT=$(echo "$PENDING_COUNT" | tr -d '[:space:]')
    if echo "$PENDING_COUNT" | grep -qE '^[0-9]+$' && [ "$PENDING_COUNT" -ge 1 ]; then
      break
    fi
  else
    LAST_DB_OUTPUT="$PENDING_COUNT"
    PENDING_COUNT=""
  fi
  sleep 3
done

if ! echo "${PENDING_COUNT:-}" | grep -qE '^[1-9][0-9]*$'; then
  echo "verify-dev-mode: FAILED — no pending action after 90s. Last DB output: ${LAST_DB_OUTPUT:-${PENDING_COUNT:-<empty>}}" >&2
  echo "--- worker log ---" >&2
  tail -30 "$WORKER_LOG" >&2 || true
  exit 1
fi

END=$(date +%s)
echo "verify-dev-mode: OK — README local-dev path proven end to end in $((END - START))s"
