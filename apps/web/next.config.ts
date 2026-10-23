import path from "node:path";
import type { NextConfig } from "next";

/**
 * `@twtdash/shared` is raw TypeScript living in `packages/shared`, outside
 * this app's directory (linked via `file:../../packages/shared`). Point both
 * Turbopack and output file tracing at the monorepo root so the linked
 * sources resolve in `next dev`, `next build` and the traced server output.
 */
const monorepoRoot = path.resolve(__dirname, "../..");

const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), interest-cohort=()" },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  transpilePackages: ["@twtdash/shared"],
  outputFileTracingRoot: monorepoRoot,
  turbopack: {
    root: monorepoRoot,
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:path*", headers: securityHeaders }];
  },
};

export default nextConfig;
