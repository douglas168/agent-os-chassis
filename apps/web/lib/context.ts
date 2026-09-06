import { db, organization, type OrgContext } from "@agentos/core";
import { auth } from "./auth";

export async function resolveOrgContext(
  headers: Headers,
  options: { persist?: boolean } = {},
): Promise<OrgContext> {
  const { persist = true } = options;
  const session = await auth.api.getSession({ headers });
  if (!session) throw new Error("no session — sign in required");

  let orgId = session.session.activeOrganizationId;
  if (!orgId) {
    const orgs = await auth.api.listOrganizations({ headers });
    if (orgs.length === 0) {
      throw new Error("user belongs to no organization — run `npm run seed`");
    }
    if (orgs.length > 1) {
      throw new Error("multiple organizations, none active — org-switcher isn't built until Plan 5");
    }
    orgId = orgs[0].id;
    // Persisting here is a session/cookie write — legal from a Route Handler
    // (every apps/web/app/api/**/route.ts caller), illegal during Server
    // Component render (layout.tsx passes persist: false for that reason).
    if (persist) {
      await auth.api.setActiveOrganization({ headers, body: { organizationId: orgId } });
    }
  }

  // getActiveMemberRole's response body is `{ role: string }` (verified,
  // context7 /better-auth/better-auth/v1.6.23) — destructure the field, don't
  // assign the whole response object to `role`.
  const { role } = await auth.api.getActiveMemberRole({ headers, query: { organizationId: orgId } });
  return { orgId, userId: session.user.id, role };
}

// No session exists on a channel webhook request. Single-org v1 default
// (spec § 7) means the org can be found directly — see this plan's
// Least-confident decisions #1 for why this doesn't scale past one org.
// role is "system", never "owner" — adversarial-plan-review round 1 finding
// 1 (sustained by the judge, 2026-08-28) caught that an unauthenticated
// ingestion path must not carry the highest role. `can()` (Task 1) returns
// false for any role not in orgRoles, so this context can never pass a
// decideAction permission check — which is correct, since nothing on this
// path calls decideAction anyway (repositories are org-scoped only).
export async function resolveChannelOrgContext(): Promise<OrgContext> {
  const orgs = await db.select().from(organization).limit(2);
  if (orgs.length === 0) {
    throw new Error("no organization seeded — run `npm run seed`");
  }
  if (orgs.length > 1) {
    throw new Error("multiple organizations exist — channel routing isn't built until a later plan");
  }
  return { orgId: orgs[0].id, userId: "system", role: "system" };
}
