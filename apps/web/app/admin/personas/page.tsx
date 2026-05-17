import { PersonaCard } from "@/components/PersonaCard";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireEnv } from "@/lib/env";
import { createClient } from "@supabase/supabase-js";

export const dynamic = "force-dynamic";

const PERSONA_EMAILS = [
  { slug: "sarah-mom", email: "sarah.parker+rfw-demo@realfoodwin.test", display: "Sarah Parker", blurb: "Mom of two — peanut/tree-nut allergy household." },
  { slug: "marcus-fitness", email: "marcus.cole+rfw-demo@realfoodwin.test", display: "Marcus Cole", blurb: "Fitness, cutting — protein bars & energy drinks." },
  { slug: "linda-inflammation", email: "linda.hayes+rfw-demo@realfoodwin.test", display: "Linda Hayes", blurb: "Anti-inflammatory journey — gluten-free, low sugar." },
  { slug: "tyler-emma-vegan", email: "tyler.fox+rfw-demo@realfoodwin.test", display: "Tyler & Emma Fox", blurb: "Vegan couple, off ultra-processed plant products." },
  { slug: "jessica-curious", email: "jessica.lee+rfw-demo@realfoodwin.test", display: "Jessica Lee", blurb: "Curious skeptic — light user, mostly browsing." },
];

export default async function PersonasAdminPage() {
  const supabase = createSupabaseServer();
  const { data: { user } } = await supabase.auth.getUser();

  // Pull persona stats from the DB so the cards show real counts.
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  type Stats = {
    user_id: string | null;
    swaps: number;
    saves: number;
    madeIt: number;
  };

  const stats: Record<string, Stats> = {};
  for (const p of PERSONA_EMAILS) {
    const { data: u } = await admin.from("users").select("id").eq("email", p.email).maybeSingle();
    const uid = u?.id ?? null;
    if (!uid) {
      stats[p.slug] = { user_id: null, swaps: 0, saves: 0, madeIt: 0 };
      continue;
    }
    const [{ count: swaps }, { count: saves }, { count: madeIt }] = await Promise.all([
      admin.from("swaps").select("id", { count: "exact", head: true }).eq("user_id", uid),
      admin.from("recipe_box_entries").select("id", { count: "exact", head: true }).eq("user_id", uid),
      admin.from("events").select("id", { count: "exact", head: true }).eq("user_id", uid).eq("event_type", "made_it_loved"),
    ]);
    stats[p.slug] = {
      user_id: uid,
      swaps: swaps ?? 0,
      saves: saves ?? 0,
      madeIt: madeIt ?? 0,
    };
  }

  return (
    <div className="space-y-6">
      <p className="text-paper/80 text-sm">
        Click "Sign in as" to view that persona's personalized Kitchen and Scorecard. Currently signed in as <strong>{user?.email ?? "(no one)"}</strong>.
      </p>

      <div className="grid md:grid-cols-2 gap-4">
        {PERSONA_EMAILS.map((p) => (
          <PersonaCard
            key={p.slug}
            display={p.display}
            email={p.email}
            blurb={p.blurb}
            stats={stats[p.slug]!}
          />
        ))}
      </div>

      <section className="card p-6 mt-2">
        <h2 className="text-base font-bold mb-2">Reseed the harness</h2>
        <p className="text-sm text-ink-soft">
          Run <code className="bg-cream px-1.5 py-0.5 rounded">corepack pnpm seed:personas</code> from the repo root. Adds any missing personas without disturbing existing data.
        </p>
      </section>
    </div>
  );
}
