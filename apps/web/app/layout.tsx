import type { Metadata, Viewport } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";
import { SwapFabGate } from "@/components/SwapFabGate";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["400", "500", "600", "700", "800"],
});

export const metadata: Metadata = {
  title: "Real Food Win — Replace ultra-processed food with real food",
  description:
    "Type a junk food, get a real-food swap with a recipe, nutrition comparison, and ingredient analysis. Personalized by an AI coach who learns you.",
  metadataBase: new URL("https://realfoodwin.org"),
  openGraph: {
    title: "Real Food Win",
    description: "Real food, family by family.",
    type: "website",
  },
};

// viewportFit=cover so the body extends under the iOS home-indicator and our
// safe-area utilities can claim that space. width=device-width keeps the
// initial layout at the device pixel width.
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#2D4828",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable}>
      {/* pb-20 md:pb-0 reserves room for the mobile bottom tab bar so content
          never tucks behind the 64-72px tall tabbar on phones. */}
      <body className="pb-20 md:pb-0">
        {children}
        {/* Floating swap entry (visible for logged-in users only). */}
        <SwapFabGate />
      </body>
    </html>
  );
}
