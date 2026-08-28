// scripts/seed.ts — replace the whole file
import { eq } from "drizzle-orm";
import { db, organization, user } from "@agentos/core";
import { auth } from "../apps/web/lib/auth";

const DEMO_OWNER_EMAIL = "owner@demo.agentos.local";
// Demo-only credential for local docker-compose dev — rotate before any
// non-local deployment.
const DEMO_OWNER_PASSWORD = "demo-password-1234";

async function main() {
  const existingOwner = await db.select().from(user).where(eq(user.email, DEMO_OWNER_EMAIL)).limit(1);
  if (existingOwner.length > 0) {
    console.log("[seed] owner already exists, skipping:", existingOwner[0].id);
    return;
  }

  const signUp = await auth.api.signUpEmail({
    body: { email: DEMO_OWNER_EMAIL, password: DEMO_OWNER_PASSWORD, name: "Demo Owner" },
  });

  const org = await auth.api.createOrganization({
    body: { name: "Demo Org", slug: "demo-org", userId: signUp.user.id },
  });

  console.log("[seed] created owner:", signUp.user.id);
  console.log("[seed] created organization:", org?.id);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
