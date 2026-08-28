import { config } from "dotenv";
import { resolve } from "node:path";

config({ path: resolve(import.meta.dirname, ".env.local") });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error(
    "TEST_DATABASE_URL is not set. The test suite deletes all rows from " +
    "several tables — running it against your dev database (DATABASE_URL) " +
    "would destroy its data. Set TEST_DATABASE_URL to a separate database " +
    "(see .env.example) before running `npm test`.",
  );
}
if (testUrl === process.env.DATABASE_URL) {
  throw new Error(
    "TEST_DATABASE_URL must not equal DATABASE_URL — tests delete all rows " +
    "from several tables and would destroy your dev database.",
  );
}
process.env.DATABASE_URL = testUrl;
