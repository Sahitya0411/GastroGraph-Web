import type { NextConfig } from "next";
import path from "path";

const nextConfig: NextConfig = {
  turbopack: {
    root: path.resolve(__dirname),
  },
  // Graph tables are read from disk at runtime (lib/localdb/engine.ts); ship them with every server route
  outputFileTracingIncludes: {
    '/**': ['./data/db/*.json'],
  },
};

export default nextConfig;
