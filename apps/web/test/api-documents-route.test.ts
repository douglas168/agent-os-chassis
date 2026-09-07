import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
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
