import type { NextConfig } from "next";
import { resolve } from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const monorepoRoot = resolve(import.meta.dirname, "../..");

const config: NextConfig = {
  turbopack: { root: monorepoRoot },
  agentRules: false,
  output: "standalone",
  outputFileTracingRoot: monorepoRoot,
};
export default withNextIntl(config);
