-- Runs once, only on a fresh (empty) postgres data volume — the official
-- postgres image executes everything in docker-entrypoint-initdb.d on first
-- init and never again. Creates the isolated database `npm test` requires
-- (see vitest.setup.ts) so a fresh `docker compose up` needs no manual step.
CREATE DATABASE agentos_test;
