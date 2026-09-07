import { afterAll, afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import * as core from "@agentos/core";
import { db, documents, member, organization } from "@agentos/core";
import { auth } from "../lib/auth";
import { GET as listDocuments, POST as uploadDocument } from "../app/api/documents/route";
import { GET as downloadDocument } from "../app/api/documents/[id]/content/route";

describe("/api/documents", () => {
  let orgId: string;
  let userId: string;
  let headers: Headers;

  beforeAll(async () => {
    const ctx = await auth.$context;
    const test = ctx.test;
    const user = test.createUser({ email: "brain-route@example.com" });
    await test.saveUser(user);
    userId = user.id;
    const org = await auth.api.createOrganization({
      body: {
        name: "Brain Route Org",
        slug: `brain-route-${crypto.randomUUID()}`,
        userId,
      },
    });
    orgId = org!.id;
    headers = await test.getAuthHeaders({ userId });
  });

  afterAll(async () => {
    await db.delete(documents).where(eq(documents.orgId, orgId));
    await db.delete(member).where(eq(member.organizationId, orgId));
    await db.delete(organization).where(eq(organization.id, orgId));
    await (await auth.$context).test.deleteUser(userId);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function uploadRequest(title: string, file: File) {
    const form = new FormData();
    form.set("title", title);
    form.set("file", file);
    return new Request("http://localhost/api/documents", {
      method: "POST",
      headers,
      body: form,
    });
  }

  function makeDistinctLargeText() {
    const tokens: string[] = [];
    let byteLength = 0;
    for (let index = 0; byteLength < 1_500_000; index += 1) {
      const token = `token${index.toString(16).padStart(8, "0")}`;
      tokens.push(token);
      byteLength += token.length + 1;
    }
    return tokens.join(" ");
  }

  it("uploads a text file, then finds it via search, then downloads its content", async () => {
    const form = new FormData();
    form.set("title", "Route test doc");
    form.set("file", new File(["overdue invoice reminder"], "note.txt", { type: "text/plain" }));

    const uploadReq = new Request("http://localhost/api/documents", {
      method: "POST",
      headers,
      body: form,
    });
    const uploadRes = await uploadDocument(uploadReq);
    expect(uploadRes.status).toBe(201);
    const created = await uploadRes.json();
    expect(created.title).toBe("Route test doc");

    const searchReq = new Request("http://localhost/api/documents?q=overdue+invoice", { headers });
    const searchRes = await listDocuments(searchReq);
    const found = await searchRes.json();
    expect(found.map((d: { id: string }) => d.id)).toContain(created.id);

    const downloadRes = await downloadDocument(
      new Request(`http://localhost/api/documents/${created.id}/content`, { headers }),
      { params: Promise.resolve({ id: created.id }) },
    );
    expect(downloadRes.status).toBe(200);
    expect(downloadRes.headers.get("content-type")).toBe("text/plain");
    expect(downloadRes.headers.get("content-disposition")).toContain("attachment");
    expect(downloadRes.headers.get("x-content-type-options")).toBe("nosniff");
    expect(await downloadRes.text()).toBe("overdue invoice reminder");
  });

  it("truncates large plain-text indexing input before building a tsvector", async () => {
    const content = makeDistinctLargeText();
    expect(Buffer.byteLength(content)).toBeGreaterThan(1_000_000);

    const uploadRes = await uploadDocument(uploadRequest(
      "Large route test doc",
      new File([content], "large.txt", { type: "text/plain" }),
    ));

    expect(uploadRes.status).toBe(201);
    const created = await uploadRes.json();
    expect(created.sizeBytes).toBe(Buffer.byteLength(content));
  });

  it("deletes the uploaded blob when document creation fails", async () => {
    const put = vi.fn(async ({ key }: { key: string }) => ({ key }));
    const deleteBlob = vi.fn(async () => {
      throw new Error("forced cleanup failure");
    });
    const storage = {
      put,
      get: vi.fn(),
      signedUrl: vi.fn(),
      delete: deleteBlob,
    };
    vi.spyOn(core, "getStorage").mockReturnValue(storage as unknown as ReturnType<typeof core.getStorage>);
    vi.spyOn(core, "createDocumentsRepo").mockReturnValue({
      create: vi.fn().mockRejectedValue(new Error("forced create failure")),
    } as unknown as ReturnType<typeof core.createDocumentsRepo>);
    vi.spyOn(console, "error").mockImplementation(() => {});

    const res = await uploadDocument(uploadRequest(
      "Failed route test doc",
      new File(["will be orphaned without cleanup"], "failed.txt", { type: "text/plain" }),
    ));

    expect(res.status).toBe(500);
    const storageKey = put.mock.calls[0]?.[0].key;
    expect(storageKey).toEqual(expect.any(String));
    expect(deleteBlob).toHaveBeenCalledWith(storageKey);
  });

  it("rejects an oversized upload before storing it", async () => {
    const form = new FormData();
    form.set("title", "Too big");
    form.set("file", new File(["x"], "big.txt", { type: "text/plain" }));
    const req = new Request("http://localhost/api/documents", {
      method: "POST",
      headers,
      body: form,
    });
    const originalMax = process.env.MAX_UPLOAD_BYTES;
    process.env.MAX_UPLOAD_BYTES = "0";
    try {
      const res = await uploadDocument(req);
      expect(res.status).toBe(413);
    } finally {
      if (originalMax === undefined) delete process.env.MAX_UPLOAD_BYTES;
      else process.env.MAX_UPLOAD_BYTES = originalMax;
    }
  });

  it("rejects a disallowed MIME type", async () => {
    const form = new FormData();
    form.set("title", "Script upload");
    form.set("file", new File(["<script>alert(1)</script>"], "x.html", { type: "text/html" }));
    const req = new Request("http://localhost/api/documents", {
      method: "POST",
      headers,
      body: form,
    });
    const res = await uploadDocument(req);
    expect(res.status).toBe(400);
  });
});
