import { describe, it, expect, afterEach } from "vitest";
import { eq } from "drizzle-orm";
import { db } from "../src/db/client";
import { user, organization } from "../src/db/schema";

describe("user.locale / organization.locale columns", () => {
  const userIds: string[] = [];
  const orgIds: string[] = [];

  afterEach(async () => {
    for (const id of userIds.splice(0)) await db.delete(user).where(eq(user.id, id));
    for (const id of orgIds.splice(0)) await db.delete(organization).where(eq(organization.id, id));
  });

  it("stores and reads back a non-null locale on user", async () => {
    const [row] = await db.insert(user)
      .values({ name: "Locale Test User", email: `locale-test-${crypto.randomUUID()}@example.com`, locale: "zh-TW" })
      .returning();
    userIds.push(row.id);
    expect(row.locale).toBe("zh-TW");
  });

  it("defaults user.locale to null when not supplied", async () => {
    const [row] = await db.insert(user)
      .values({ name: "Locale Default User", email: `locale-default-${crypto.randomUUID()}@example.com` })
      .returning();
    userIds.push(row.id);
    expect(row.locale).toBeNull();
  });

  it("stores and reads back a non-null locale on organization", async () => {
    const [row] = await db.insert(organization)
      .values({ name: "Locale Test Org", slug: `locale-test-org-${crypto.randomUUID()}`, createdAt: new Date(), locale: "en" })
      .returning();
    orgIds.push(row.id);
    expect(row.locale).toBe("en");
  });

  it("defaults organization.locale to null when not supplied", async () => {
    const [row] = await db.insert(organization)
      .values({ name: "Locale Default Org", slug: `locale-default-org-${crypto.randomUUID()}`, createdAt: new Date() })
      .returning();
    orgIds.push(row.id);
    expect(row.locale).toBeNull();
  });
});
