import { NextResponse } from "next/server";
import { createDocumentsRepo, db, getStorage } from "@agentos/core";
import { resolveOrgContext } from "../../../../../lib/context";

function safeDownloadFilename(name: string) {
  const sanitized = name
    .replace(/["\\\r\n]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "_");
  return sanitized || "download";
}

export async function GET(req: Request, { params }: { params: Promise<{ id: string }> }) {
  let ctx;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch (err) {
    console.error("resolveOrgContext failed:", err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const doc = await createDocumentsRepo(db).findById(ctx, id);
  if (!doc) return NextResponse.json({ error: "not found" }, { status: 404 });

  let body: Buffer;
  try {
    body = await getStorage().get(doc.storageKey);
  } catch (err) {
    console.error("read document failed:", err);
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // Always download user-controlled content. nosniff prevents the browser
  // from reinterpreting the stored MIME type for an inline same-origin page.
  return new NextResponse(new Uint8Array(body), {
    status: 200,
    headers: {
      "Content-Type": doc.mime,
      "Content-Disposition": `attachment; filename="${safeDownloadFilename(doc.title)}"`,
      "X-Content-Type-Options": "nosniff",
    },
  });
}
