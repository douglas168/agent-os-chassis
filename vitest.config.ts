import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import { resolve } from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@": resolve(import.meta.dirname, "apps/web"),
    },
  },
  esbuild: {
    jsx: "automatic",
  },
  test: {
    include: [
      "packages/*/test/**/*.test.ts",
      "apps/*/test/**/*.test.ts",
      "apps/*/test/**/*.test.tsx",
      "test/**/*.test.ts",
    ],
    environment: "node",
    environmentMatchGlobs: [["apps/web/test/**/*.test.tsx", "jsdom"]],
    setupFiles: [
      resolve(import.meta.dirname, "vitest.setup.ts"),
      resolve(import.meta.dirname, "apps/web/test/setup.ts"),
    ],
    // Tests under packages/core hit one shared, real Postgres DB and mutate
    // global tables (organizations) in afterAll — running files in parallel
    // races those mutations against other files' still-in-progress tests.
    fileParallelism: false,
  },
});
