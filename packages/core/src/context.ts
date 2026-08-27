import { eq } from "drizzle-orm";
import { db } from "./db/client";
import { organizations } from "./db/schema";

export type OrgContext = { orgId: string };

// Plan 1 stub — replaced by session-derived context in Plan 2 (Better-Auth).
export async function resolveOrgContext(): Promise<OrgContext> {
  const [org] = await db.select().from(organizations).limit(1);
  if (!org) throw new Error("no organization seeded — run `npm run seed`");
  return { orgId: org.id };
}
