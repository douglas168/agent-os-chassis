import { afterEach, describe, expect, it } from "vitest";
import { eq, inArray } from "drizzle-orm";
import { db } from "../src/db/client";
import { documents, organization } from "../src/db/schema";
import { createDocumentsRepo } from "../src/repositories/documents";

describe("documents repository", () => {
  const orgIds: string[] = [];

  async function makeOrg() {
    const [row] = await db.insert(organization)
      .values({
        id: crypto.randomUUID(),
        name: "Brain Test Org",
        slug: `brain-test-${crypto.randomUUID()}`,
        createdAt: new Date(),
      })
      .returning();
    orgIds.push(row.id);
    return row;
  }

  afterEach(async () => {
    if (orgIds.length === 0) return;
    await db.delete(documents).where(inArray(documents.orgId, orgIds));
    await db.delete(organization).where(inArray(organization.id, orgIds));
    orgIds.length = 0;
  });

  it("creates a document with plain-text extraction and finds it back by id, org-scoped", async () => {
    const org = await makeOrg();
    const otherOrg = await makeOrg();
    const repo = createDocumentsRepo(db);
    const ctx = { orgId: org.id, userId: "system", role: "owner" };

    const created = await repo.create(ctx, {
      title: "Q3 notes", source: "upload", mime: "text/plain", sizeBytes: 11,
      storageKey: "docs/q3-notes.txt", text: "hello world",
    });

    const found = await repo.findById(ctx, created.id);
    expect(found?.title).toBe("Q3 notes");

    const foundByOtherOrg = await repo.findById(
      { orgId: otherOrg.id, userId: "system", role: "owner" },
      created.id,
    );
    expect(foundByOtherOrg).toBeNull();
  });

  it("creates a document with null extracted_text when no text is supplied (non-text upload)", async () => {
    const org = await makeOrg();
    const repo = createDocumentsRepo(db);
    const ctx = { orgId: org.id, userId: "system", role: "owner" };
    const created = await repo.create(ctx, {
      title: "logo.png", source: "upload", mime: "image/png", sizeBytes: 2048,
      storageKey: "docs/logo.png", text: null,
    });
    const [raw] = await db.select().from(documents).where(eq(documents.id, created.id));
    expect(raw.extractedText).toBeNull();
  });

  it("search finds a document whose extracted_text matches the query, org-scoped, via plainto_tsquery", async () => {
    const org = await makeOrg();
    const otherOrg = await makeOrg();
    const repo = createDocumentsRepo(db);
    const ctx = { orgId: org.id, userId: "system", role: "owner" };
    await repo.create(ctx, {
      title: "invoice policy", source: "upload", mime: "text/plain", sizeBytes: 30,
      storageKey: "docs/policy.txt", text: "overdue invoices escalate after fourteen days",
    });
    await repo.create({ orgId: otherOrg.id, userId: "system", role: "owner" }, {
      title: "other org doc", source: "upload", mime: "text/plain", sizeBytes: 20,
      storageKey: "docs/other.txt", text: "overdue invoices in another org",
    });

    const found = await repo.search(ctx, "overdue invoices");
    expect(found).toHaveLength(1);
    expect(found[0].title).toBe("invoice policy");
  });

  it("listForOrg returns documents newest first, org-scoped", async () => {
    const org = await makeOrg();
    const repo = createDocumentsRepo(db);
    const ctx = { orgId: org.id, userId: "system", role: "owner" };
    const first = await repo.create(ctx, {
      title: "first", source: "upload", mime: "text/plain", sizeBytes: 1,
      storageKey: "docs/a.txt", text: "a",
    });
    const second = await repo.create(ctx, {
      title: "second", source: "upload", mime: "text/plain", sizeBytes: 1,
      storageKey: "docs/b.txt", text: "b",
    });
    const all = await repo.listForOrg(ctx);
    expect(all.map((d) => d.id)).toEqual([second.id, first.id]);
  });
});
