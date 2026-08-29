export * from "./types";
export * from "./local-disk";
export * from "./s3-stub";

import { createLocalDiskStorage } from "./local-disk";
import type { Storage } from "./types";

export function getStorage(): Storage {
  const root = process.env.STORAGE_ROOT;
  if (!root) throw new Error("STORAGE_ROOT is not set — see .env.example");
  return createLocalDiskStorage(root);
}
