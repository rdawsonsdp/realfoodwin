import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { requireEnv, supabasePublishableKey } from "../env";

/**
 * Server-side Supabase client bound to the current request's cookies.
 * RLS applies as the authenticated user (or anon if no session).
 */
export function createSupabaseServer() {
  const cookieStore = cookies();
  return createServerClient(requireEnv("NEXT_PUBLIC_SUPABASE_URL"), supabasePublishableKey(), {
    cookies: {
      get(name: string) {
        return cookieStore.get(name)?.value;
      },
      set(name: string, value: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value, ...options });
        } catch {
          // Read-only context (Server Component). Ignore — middleware refreshes the session.
        }
      },
      remove(name: string, options: CookieOptions) {
        try {
          cookieStore.set({ name, value: "", ...options });
        } catch {
          // Same as above.
        }
      },
    },
  });
}
