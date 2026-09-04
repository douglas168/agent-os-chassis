import "@testing-library/jest-dom/vitest";
import { config } from "dotenv";
import { resolve } from "node:path";
import { vi } from "vitest";

// Component tests render outside Next's App Router context.
vi.mock("next/navigation", () => ({
  useRouter: () => ({ refresh: vi.fn() }),
}));

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
function dbIdentity(url: string): string {
  // Compares the connection target, not the raw string — "postgres://" vs
  // "postgresql://" and other formatting differences must not defeat this
  // guard the way a plain === would. Falls back to the raw string if it
  // doesn't parse as a URL at all, so a malformed value still gets compared
  // rather than crashing this setup file with an unrelated TypeError.
  try {
    const parsed = new URL(url);
    return `${parsed.hostname}:${parsed.port}${parsed.pathname}`;
  } catch {
    return url;
  }
}

if (dbIdentity(testUrl) === dbIdentity(process.env.DATABASE_URL ?? "")) {
  throw new Error(
    "TEST_DATABASE_URL must not point at the same database as DATABASE_URL " +
    "— tests delete all rows from several tables and would destroy your dev database.",
  );
}
process.env.DATABASE_URL = testUrl;
