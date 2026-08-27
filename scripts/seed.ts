import { db, organizations } from "@agentos/core";

async function main() {
  const existing = await db.select().from(organizations).limit(1);
  if (existing.length > 0) {
    console.log("[seed] organization already exists, skipping:", existing[0].id);
    return;
  }
  const [org] = await db.insert(organizations).values({ name: "Demo Org" }).returning();
  console.log("[seed] created organization:", org.id);
}

main().then(() => process.exit(0)).catch((err) => { console.error(err); process.exit(1); });
