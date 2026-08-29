export type PutInput = { key: string; body: Buffer | Uint8Array; contentType: string };

// Spec § 6.1 — "documents.storage_key is a key, not a filesystem path,
// because packages/core exposes a Storage interface with two
// implementations: local disk (v1 default) and an S3-compatible stub — the
// same one-interface/one-impl/one-stub shape as ChannelAdapter."
export interface Storage {
  put(input: PutInput): Promise<{ key: string }>;
  get(key: string): Promise<Buffer>;
  signedUrl(key: string, opts?: { expiresInSeconds?: number }): Promise<string>;
  delete(key: string): Promise<void>;
}
