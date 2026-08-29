import type { Storage } from "./types";

// Spec § 6.1 / § 12: "an S3-compatible stub with the interface complete and
// credentials blank" — no AWS SDK dependency, no working implementation.
export function createS3StubStorage(): Storage {
  const notConfigured = () => Promise.reject(new Error(
    "S3 storage is not configured: it is a stub in v1 (spec § 6.1) with no credentials.",
  ));
  return { put: notConfigured, get: notConfigured, signedUrl: notConfigured, delete: notConfigured };
}
