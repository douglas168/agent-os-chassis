import type { NextConfig } from "next";
import { resolve } from "node:path";
import createNextIntlPlugin from "next-intl/plugin";

const withNextIntl = createNextIntlPlugin("./i18n/request.ts");

const config: NextConfig = {
  turbopack: { root: resolve(import.meta.dirname, "../..") },
  agentRules: false,
};
export default withNextIntl(config);
