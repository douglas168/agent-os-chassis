import { defineConfig } from "vitest/config";
import { resolve } from "node:path";

export default defineConfig({
  test: {
    include: [
      "packages/*/test/**/*.test.ts",
      "apps/*/test/**/*.test.ts",
      "test/**/*.test.ts",
    ],
    environment: "node",
    setupFiles: [resolve(import.meta.dirname, "vitest.setup.ts")],
    // Tests under packages/core hit one shared, real Postgres DB and mutate
    // global tables (organizations) in afterAll — running files in parallel
    // races those mutations against other files' still-in-progress tests.
    fileParallelism: false,
  },
});
