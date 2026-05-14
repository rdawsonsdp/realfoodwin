import type { Metadata } from "next";
import { Plus_Jakarta_Sans } from "next/font/google";
import "./globals.css";

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

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={jakarta.variable}>
      <body>{children}</body>
    </html>
  );
}
