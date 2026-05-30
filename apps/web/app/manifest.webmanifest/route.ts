// PWA manifest. Served dynamically so it lives in the app directory next to
// the rest of the metadata and can be tweaked without a static file.
//
// Pointing start_url at /scan means tapping the home-screen icon lands the
// user directly in camera mode — the in-store thumb-launch UX.

import { NextResponse } from "next/server";

export const dynamic = "force-static";
export const runtime = "edge";

export function GET() {
  const manifest = {
    name: "Real Food Win",
    short_name: "RFW",
    description:
      "Replace ultra-processed food with real food. Scan a product, get a real-food swap.",
    start_url: "/scan",
    scope: "/",
    display: "standalone",
    background_color: "#2D4828",
    theme_color: "#2D4828",
    orientation: "portrait",
    icons: [
      {
        // SVG works for modern iOS/Android. Replace with PNGs (192, 512,
        // maskable) when a designer-final icon is ready.
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any maskable",
      },
    ],
    shortcuts: [
      {
        name: "Scan a product",
        short_name: "Scan",
        url: "/scan",
      },
      {
        name: "The Kitchen",
        short_name: "Kitchen",
        url: "/kitchen",
      },
    ],
    categories: ["food", "health", "lifestyle"],
  };

  return NextResponse.json(manifest, {
    headers: {
      "Content-Type": "application/manifest+json",
      "Cache-Control": "public, max-age=3600",
    },
  });
}
