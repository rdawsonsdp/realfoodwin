// /scan — the always-on Scan entry point. Lands the user directly in the
// camera-first SwapModal. Designed for "tap → scan a product" in-store with
// minimum friction; pairs with the home-screen PWA install so the icon tap
// effectively becomes a one-action launch.
//
// Why a dedicated route vs. just the FAB: the FAB requires a tap on an
// already-loaded page. /scan can be a bookmark, a home-screen icon, a
// shortcut, or a deep link — anything that lands a URL is one tap from the
// camera.

import { redirect } from "next/navigation";
import { Nav } from "@/components/Nav";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ScanLanding } from "@/components/ScanLanding";

export const dynamic = "force-dynamic";

export default async function ScanPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    redirect("/sign-in?next=" + encodeURIComponent("/scan"));
  }

  return (
    <>
      <Nav />
      <ScanLanding />
    </>
  );
}
