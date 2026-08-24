import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    const corsHeaders = [
        { key: "Access-Control-Allow-Origin", value: process.env.HUD_ORIGIN ?? "https://app.tpn.local" },
        { key: "Access-Control-Allow-Credentials", value: "true" },
        { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
        { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
        { key: "Vary", value: "Origin" },
    ];
    return [
      { source: "/api/quests/:path*", headers: corsHeaders },
      { source: "/api/minimap/:path*", headers: corsHeaders },
      { source: "/api/me", headers: corsHeaders },
      { source: "/api/hud-auth/:path*", headers: corsHeaders },
    ];
  },
};

export default nextConfig;
