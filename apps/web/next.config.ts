import type { NextConfig } from "next";
import { resolve } from "node:path";

const config: NextConfig = {
  turbopack: { root: resolve(import.meta.dirname, "../..") },
  agentRules: false,
};
export default config;
