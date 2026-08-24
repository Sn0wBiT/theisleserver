import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [{
      source: "/api/quests/:path*",
      headers: [
        { key: "Access-Control-Allow-Origin", value: process.env.HUD_ORIGIN ?? "https://app.tpn.local" },
        { key: "Access-Control-Allow-Credentials", value: "true" },
        { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
        { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
        { key: "Vary", value: "Origin" },
      ],
    }];
  },
};

export default nextConfig;
