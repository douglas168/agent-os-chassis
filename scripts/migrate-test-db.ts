// scripts/migrate-test-db.ts — runs drizzle-kit migrate against
// TEST_DATABASE_URL instead of DATABASE_URL. `npm run db:migrate` always
// targets DATABASE_URL (drizzle.config.ts), so the isolated test database
// vitest.setup.ts requires has no other way to pick up schema changes.
import { spawnSync } from "node:child_process";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  console.error(
    "TEST_DATABASE_URL is not set. Run this with --env-file=.env.local " +
    "(see the \"db:migrate:test\" script), or set it directly.",
  );
  process.exit(1);
}

const result = spawnSync("npm", ["run", "db:migrate", "--workspace=@agentos/core"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testUrl },
});
process.exit(result.status ?? 1);
