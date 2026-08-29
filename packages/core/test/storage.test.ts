import { describe, it, expect } from "vitest";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { rm } from "node:fs/promises";
import { createLocalDiskStorage } from "../src/storage/local-disk";
import { createS3StubStorage } from "../src/storage/s3-stub";

describe("local disk storage", () => {
  it("provisions its own root directory on first put, on a genuinely fresh path", async () => {
    // A path guaranteed never to have existed before this test run — proves
    // the directory is created on demand, not assumed to already exist.
    const freshRoot = join(tmpdir(), `agentos-storage-test-${crypto.randomUUID()}`);
    const storage = createLocalDiskStorage(freshRoot);

    await storage.put({ key: "docs/hello.txt", body: Buffer.from("hello"), contentType: "text/plain" });
    const read = await storage.get("docs/hello.txt");
    expect(read.toString()).toBe("hello");

    await storage.delete("docs/hello.txt");
    await expect(storage.get("docs/hello.txt")).rejects.toThrow();

    await rm(freshRoot, { recursive: true, force: true });
  });

  it("refuses a key that would escape the storage root", async () => {
    const freshRoot = join(tmpdir(), `agentos-storage-test-${crypto.randomUUID()}`);
    const storage = createLocalDiskStorage(freshRoot);
    await expect(storage.put({ key: "../../etc/passwd", body: Buffer.from("x"), contentType: "text/plain" }))
      .rejects.toThrow(/escapes root/);
  });

  it("signedUrl throws rather than returning a raw filesystem path (LCD4, spec § 6.1)", async () => {
    const freshRoot = join(tmpdir(), `agentos-storage-test-${crypto.randomUUID()}`);
    const storage = createLocalDiskStorage(freshRoot);
    await storage.put({ key: "docs/hello.txt", body: Buffer.from("hello"), contentType: "text/plain" });
    await expect(storage.signedUrl("docs/hello.txt")).rejects.toThrow(/not implemented/i);
    await rm(freshRoot, { recursive: true, force: true });
  });
});

describe("S3 stub storage", () => {
  it("every method rejects with a clear not-configured error, never throws synchronously or silently no-ops", async () => {
    const storage = createS3StubStorage();
    await expect(storage.put({ key: "x", body: Buffer.from(""), contentType: "text/plain" })).rejects.toThrow(/not configured/i);
    await expect(storage.get("x")).rejects.toThrow(/not configured/i);
    await expect(storage.signedUrl("x")).rejects.toThrow(/not configured/i);
    await expect(storage.delete("x")).rejects.toThrow(/not configured/i);
  });
});
