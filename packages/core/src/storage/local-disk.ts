import { mkdir, readFile, writeFile, rm } from "node:fs/promises";
import { dirname, resolve, relative } from "node:path";
import type { Storage, PutInput } from "./types";

export function createLocalDiskStorage(root: string): Storage {
  const resolvedRoot = resolve(root);

  function resolveKey(key: string): string {
    const full = resolve(resolvedRoot, key);
    if (relative(resolvedRoot, full).startsWith("..")) {
      throw new Error(`storage key escapes root: ${key}`);
    }
    return full;
  }

  return {
    async put({ key, body }: PutInput) {
      const path = resolveKey(key);
      await mkdir(dirname(path), { recursive: true });
      await writeFile(path, body);
      return { key };
    },
    async get(key: string) {
      return readFile(resolveKey(key));
    },
    async signedUrl(key: string) {
      // Spec § 6.1: "storage_key is a key, not a filesystem path." Returning
      // the resolved path here would violate that contract and leak the
      // storage root's directory structure to a caller. No HTTP route
      // exists yet to serve a local-disk key (Plan 5's /brain UI is the
      // first consumer) — fail loudly instead, same posture as the S3
      // stub's not-configured errors. See this plan's Least-confident
      // decision #4.
      throw new Error(`signedUrl not implemented for local-disk storage until a serving route exists (key: ${key})`);
    },
    async delete(key: string) {
      await rm(resolveKey(key), { force: true });
    },
  };
}
