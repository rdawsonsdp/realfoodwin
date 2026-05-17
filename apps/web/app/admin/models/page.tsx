import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import { ModelSelector } from "@/components/ModelSelector";
import { AnthropicModelProbe } from "@/components/AnthropicModelProbe";

export const dynamic = "force-dynamic";

const DEFAULTS = { sonnet: "claude-sonnet-4-6", haiku: "claude-haiku-4-5-20251001" };

export default async function AdminModelsPage() {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data } = await admin
    .from("app_settings")
    .select("key, value, updated_at")
    .in("key", ["model.sonnet", "model.haiku"]);

  const map = new Map(
    (data ?? []).map((r: { key: string; value: string; updated_at: string }) => [
      r.key,
      r,
    ]),
  );
  const sonnet = (map.get("model.sonnet") as { value?: string } | undefined)?.value ?? DEFAULTS.sonnet;
  const haiku = (map.get("model.haiku") as { value?: string } | undefined)?.value ?? DEFAULTS.haiku;
  const sonnetUpdated = (map.get("model.sonnet") as { updated_at?: string } | undefined)?.updated_at;
  const haikuUpdated = (map.get("model.haiku") as { updated_at?: string } | undefined)?.updated_at;

  return (
    <div className="space-y-6">
      <p className="text-ink-soft text-sm">
        Override which Anthropic model the gateway calls for each tier. Changes
        take effect within 60 seconds (gateway caches the resolution to keep DB
        load minimal). If the model returns 404 from Anthropic, try a different
        ID — your API key may not have access.
      </p>

      <ModelSelector
        initialSonnet={sonnet}
        initialHaiku={haiku}
        sonnetUpdated={sonnetUpdated ?? null}
        haikuUpdated={haikuUpdated ?? null}
      />

      <AnthropicModelProbe />

      <section className="card p-5 text-sm space-y-2">
        <h3 className="font-bold mb-1">Reference: known model IDs</h3>
        <p className="text-ink-soft">
          <strong>Sonnet (user-facing):</strong> claude-sonnet-4-5 · claude-sonnet-4-5-20250929 · claude-sonnet-4-6 · claude-3-5-sonnet-latest · claude-3-5-sonnet-20241022
        </p>
        <p className="text-ink-soft">
          <strong>Haiku (background):</strong> claude-haiku-4-5 · claude-haiku-4-5-20251001 · claude-3-5-haiku-latest · claude-3-5-haiku-20241022
        </p>
        <p className="text-ink-muted text-xs italic mt-2">
          The aliases (e.g. claude-sonnet-4-5) auto-roll forward to the latest stable revision. Use date-suffixed IDs only if you need to pin a specific snapshot.
        </p>
      </section>
    </div>
  );
}
