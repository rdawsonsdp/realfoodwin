// SwapFabGate — server component that decides whether to render the floating
// swap button based on whether the user is signed in. Anonymous visitors
// already see the SwapHero prominently on the landing page, so the FAB would
// be duplicative for them.

import { createSupabaseServer } from "@/lib/supabase/server";
import { SwapFab } from "./SwapFab";

export async function SwapFabGate() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return <SwapFab />;
}
