// Typed env access. Missing required keys throw with a clear FLAG message
// so the user knows when to drop in a credential. Per project directive:
// "build the service, flag a message when the service is called."

type RequiredKey =
  | "ANTHROPIC_API_KEY"
  | "NEXT_PUBLIC_SUPABASE_URL"
  | "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"
  | "SUPABASE_SERVICE_ROLE_KEY";

type OptionalKey =
  | "NEXT_PUBLIC_SUPABASE_ANON_KEY"
  | "VOYAGE_API_KEY"
  | "RESEND_API_KEY"
  | "RESEND_FROM"
  | "HELICONE_API_KEY";

export function requireEnv(key: RequiredKey): string {
  const v = process.env[key];
  if (!v) {
    const flag = `[FLAG] Missing env: ${key}. Drop it in .env.local (and Vercel env vars on deploy) — this code path needs it.`;
    // eslint-disable-next-line no-console
    console.error(flag);
    throw new Error(flag);
  }
  return v;
}

export function optionalEnv(key: OptionalKey): string | undefined {
  return process.env[key];
}

export function supabasePublishableKey(): string {
  // Accept either name; new "publishable" alias is the same value as the legacy "anon" key.
  const v =
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ??
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!v) {
    throw new Error(
      "[FLAG] Missing env: NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY (or legacy NEXT_PUBLIC_SUPABASE_ANON_KEY).",
    );
  }
  return v;
}
