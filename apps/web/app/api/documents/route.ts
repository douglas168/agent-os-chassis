import { NextResponse } from "next/server";
import { createDocumentsRepo, db, getStorage } from "@agentos/core";
import { resolveOrgContext } from "../../../lib/context";

const DEFAULT_MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const MAX_EXTRACTED_TEXT_BYTES = 500_000;
const DEFAULT_ALLOWED_MIME_TYPES = [
  "text/plain",
  "application/pdf",
  "image/png",
  "image/jpeg",
];

function getUploadConfig() {
  const configuredMax = Number(process.env.MAX_UPLOAD_BYTES);
  const maxBytes = Number.isFinite(configuredMax) && configuredMax >= 0
    ? configuredMax
    : DEFAULT_MAX_UPLOAD_BYTES;
  const allowedMimeTypes = process.env.ALLOWED_UPLOAD_MIME_TYPES === undefined
    ? DEFAULT_ALLOWED_MIME_TYPES
    : process.env.ALLOWED_UPLOAD_MIME_TYPES.split(",").map((mime) => mime.trim()).filter(Boolean);
  return { maxBytes, allowedMimeTypes };
}

function safeFilename(name: string) {
  const sanitized = name
    .replace(/[\\/]/g, "_")
    .replace(/[\u0000-\u001f\u007f]/g, "_");
  return sanitized || "upload";
}

function truncateUtf8(buffer: Buffer, maxBytes: number) {
  if (buffer.byteLength <= maxBytes) return buffer.toString("utf-8");

  let end = maxBytes;
  while (end > 0 && (buffer[end]! & 0xc0) === 0x80) end -= 1;
  return buffer.subarray(0, end).toString("utf-8");
}

export async function GET(req: Request) {
  let ctx;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch (err) {
    console.error("resolveOrgContext failed:", err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  try {
    const query = new URL(req.url).searchParams.get("q");
    const repo = createDocumentsRepo(db);
    const rows = query ? await repo.search(ctx, query) : await repo.listForOrg(ctx);
    return NextResponse.json(rows);
  } catch (err) {
    console.error("list documents failed:", err);
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  let ctx;
  try {
    ctx = await resolveOrgContext(req.headers);
  } catch (err) {
    console.error("resolveOrgContext failed:", err);
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let form: FormData;
  try {
    form = await req.formData();
  } catch (err) {
    console.error("parse document upload failed:", err);
    return NextResponse.json({ error: "invalid multipart form" }, { status: 400 });
  }

  const file = form.get("file");
  const title = form.get("title");
  if (!(file instanceof File) || typeof title !== "string" || title.trim() === "") {
    return NextResponse.json({ error: "file and title are required" }, { status: 400 });
  }

  const { maxBytes, allowedMimeTypes } = getUploadConfig();
  if (file.size > maxBytes) {
    return NextResponse.json({ error: `file exceeds the ${maxBytes}-byte limit` }, { status: 413 });
  }
  if (!allowedMimeTypes.includes(file.type)) {
    return NextResponse.json({ error: `unsupported file type "${file.type}"` }, { status: 400 });
  }

  const buffer = Buffer.from(await file.arrayBuffer());
  const storageKey = `documents/${ctx.orgId}/${crypto.randomUUID()}-${safeFilename(file.name)}`;

  let storage: ReturnType<typeof getStorage> | undefined;
  try {
    storage = getStorage();
    await storage.put({
      key: storageKey,
      body: buffer,
      contentType: file.type || "application/octet-stream",
    });

    // v1 only extracts plain text. Other supported MIME types remain
    // downloadable but are intentionally excluded from full-text search.
    const text = file.type === "text/plain" ? truncateUtf8(buffer, MAX_EXTRACTED_TEXT_BYTES) : null;
    return NextResponse.json(await createDocumentsRepo(db).create(ctx, {
      title: title.trim(),
      source: "upload",
      mime: file.type || "application/octet-stream",
      sizeBytes: buffer.byteLength,
      storageKey,
      text,
    }), { status: 201 });
  } catch (err) {
    console.error("store document failed:", err);
    if (storage) {
      try {
        await storage.delete(storageKey);
      } catch (cleanupErr) {
        console.error("cleanup uploaded document failed:", cleanupErr);
      }
    }
    return NextResponse.json({ error: "internal error" }, { status: 500 });
  }
}
