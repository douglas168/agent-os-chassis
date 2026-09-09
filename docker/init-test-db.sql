-- Runs once, only on a fresh (empty) postgres data volume — the official
-- postgres image executes everything in docker-entrypoint-initdb.d on first
-- init and never again. Creates the isolated database `npm test` requires
-- (see vitest.setup.ts) so a fresh `docker compose up` needs no manual step.
-- Quoted: the rename engine's bare-token rewrite can turn "agentos_test"
-- into a hyphenated identifier (e.g. "acme-quotes_test", FORKING.md's own
-- example slug), which Postgres rejects unquoted.
CREATE DATABASE "agentos_test";
