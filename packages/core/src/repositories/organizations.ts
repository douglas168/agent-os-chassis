import type { db as Db } from "../db/client";
import { organizations } from "../db/schema";

export function createOrganizationsRepo(db: typeof Db) {
  return {
    async create(input: { name: string }) {
      const [row] = await db.insert(organizations).values(input).returning();
      return row;
    },
  };
}
