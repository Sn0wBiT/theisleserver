import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  experimental: {
    useTypeScriptCli: false,
  },
  async headers() {
    const corsHeaders = [
        { key: "Access-Control-Allow-Origin", value: process.env.HUD_ORIGIN ?? "http://dino.tpnrp.local" },
        { key: "Access-Control-Allow-Credentials", value: "true" },
        { key: "Access-Control-Allow-Headers", value: "Authorization, Content-Type" },
        { key: "Access-Control-Allow-Methods", value: "GET, POST, OPTIONS" },
        { key: "Vary", value: "Origin" },
    ];
    return [
      { source: "/api/quests/:path*", headers: corsHeaders },
      { source: "/api/minimap/:path*", headers: corsHeaders },
      { source: "/api/me", headers: corsHeaders },
      { source: "/api/game/:path*", headers: corsHeaders },
      { source: "/api/hud-auth/:path*", headers: corsHeaders },
    ];
  },
  allowedDevOrigins: ['113.172.117.131'],
};

export default nextConfig;
