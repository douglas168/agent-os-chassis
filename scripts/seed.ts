// scripts/seed.ts — replace the whole file
import { eq } from "drizzle-orm";
import { db, organization, user, contacts } from "@agentos/core";
// finding 14: skillArInvoices is a @agentos/skills export, never
// re-exported through @agentos/core.
import { skillArInvoices } from "@agentos/skills";
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
  if (!org) throw new Error("[seed] createOrganization returned no organization");

  const [contact] = await db.insert(contacts)
    .values({ id: crypto.randomUUID(), orgId: org.id, name: "Demo Customer", emails: ["customer@demo.agentos.local"] })
    .returning();

  // Spec § 6: "demo invoices into skill_ar_invoices" — one overdue (cron
  // finds it immediately after seed), one not yet due. Demo documents
  // (also named in spec § 6) are out of this plan's scope — no Storage-backed
  // upload UI exists yet (Plan 5).
  await db.insert(skillArInvoices).values([
    { id: crypto.randomUUID(), orgId: org.id, contactId: contact.id, invoiceNumber: "INV-1001", amountCents: 12000, dueAt: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), stage: "issued" },
    { id: crypto.randomUUID(), orgId: org.id, contactId: contact.id, invoiceNumber: "INV-1002", amountCents: 8500, dueAt: new Date(Date.now() + 10 * 24 * 60 * 60 * 1000), stage: "issued" },
  ]);

  console.log("[seed] created owner:", signUp.user.id);
  console.log("[seed] created organization:", org.id);
  console.log("[seed] created demo contact and 2 demo invoices (1 overdue, 1 not yet due)");
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
