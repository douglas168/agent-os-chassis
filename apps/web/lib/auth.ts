import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { organization, admin, testUtils } from "better-auth/plugins";
import { db } from "@agentos/core";
import { ac, orgRoles } from "@agentos/core";

export const auth = betterAuth({
  database: drizzleAdapter(db, { provider: "pg" }),
  advanced: {
    database: {
      // Keep every Better-Auth table's id column type consistent with the
      // rest of this schema's `uuid("id").primaryKey().defaultRandom()`
      // convention (verified — context7 /better-auth/better-auth/v1.6.23
      // "UUIDs" doc: this makes the CLI emit `uuid` columns for Postgres).
      generateId: "uuid",
    },
  },
  emailAndPassword: { enabled: true },
  plugins: [
    organization({ ac, roles: orgRoles, creatorRole: "owner" }),
    admin(),
    // testUtils() is wired here, not in a later task, because Task 3's own
    // tests (the very next task) already need `(await auth.$context).test` —
    // adding it later would leave every task between here and wherever it
    // landed unable to pass its own TDD cycle. Test-only, per Better-Auth's
    // own documented pattern (verified, context7 /better-auth/better-auth,
    // test-utils.mdx "auth.ts" example); Vitest sets NODE_ENV=test itself
    // when it isn't already set (verified, context7 /vitest-dev/vitest —
    // "process.env.NODE_ENV ??= 'test'"), so no extra env wiring is needed
    // for this condition to be true under every `vitest run` in this plan.
    ...(process.env.NODE_ENV === "test" ? [testUtils()] : []),
  ],
});
