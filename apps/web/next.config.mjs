/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  transpilePackages: ["@realfoodwin/types", "@realfoodwin/gateway", "@realfoodwin/agents"],
  experimental: {
    serverActions: {
      bodySizeLimit: "2mb",
    },
  },
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "**.supabase.co" },
      { protocol: "https", hostname: "realfoodwin.org" },
    ],
  },
};

export default nextConfig;
