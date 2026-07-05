import type { NextConfig } from "next";

// Allow NAT traversal / tunnel origins for dev WebSocket HMR.
// Set TUNNEL_ORIGIN=47.92.28.8:54949 (or comma-separated list) when using 内网穿透.
const tunnelOrigins = process.env.TUNNEL_ORIGIN ? process.env.TUNNEL_ORIGIN.split(",").map((s) => s.trim()) : [];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  logging: { fetches: { fullUrl: false } },
  ...(tunnelOrigins.length > 0 && { allowedDevOrigins: tunnelOrigins }),
  outputFileTracingExcludes: {
    "/api/agent/run": ["./**/*"],
    "/api/reports": ["./**/*"],
    "/api/reports/[id]": ["./**/*"],
    "/api/tasks": ["./**/*"],
    "/api/tasks/[id]": ["./**/*"],
    "/api/traces": ["./**/*"]
  }
};

export default nextConfig;
