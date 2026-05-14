import Link from "next/link";
import { Nav } from "@/components/Nav";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";

export default async function SettingsPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=" + encodeURIComponent("/settings"));

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("*")
    .eq("user_id", user.id)
    .maybeSingle();

  const { data: summary } = await supabase
    .from("user_summaries")
    .select("summary_text, generated_at")
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <header>
          <h1 className="text-4xl font-bold tracking-tight">Account</h1>
          <p className="text-ink-soft mt-1">Signed in as <strong>{user.email}</strong></p>
        </header>

        <section className="card p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold">Your profile</h2>
            <Link href="/quiz" className="btn-secondary py-2">Re-do quiz</Link>
          </div>
          {profile ? (
            <dl className="grid grid-cols-2 gap-y-3 text-sm">
              <dt className="text-ink-muted">Dietary pattern</dt>
              <dd>{profile.dietary_pattern?.join(", ") || "—"}</dd>
              <dt className="text-ink-muted">Allergies</dt>
              <dd>{profile.allergies?.join(", ") || "—"}</dd>
              <dt className="text-ink-muted">Cooking for</dt>
              <dd>{profile.household_composition ?? "—"}</dd>
              <dt className="text-ink-muted">Top goal</dt>
              <dd>{profile.top_goal ?? "—"}</dd>
              <dt className="text-ink-muted">Weeknight time</dt>
              <dd>{profile.weeknight_time ? `${profile.weeknight_time} min` : "—"}</dd>
              <dt className="text-ink-muted">Skill level</dt>
              <dd>{profile.skill_level ?? "—"}</dd>
            </dl>
          ) : (
            <p className="text-ink-muted">No profile yet — <Link href="/quiz" className="text-sunrise underline">take the quiz</Link>.</p>
          )}
        </section>

        {summary?.summary_text && (
          <section className="card p-6">
            <h2 className="text-xl font-bold mb-3">What we know about you</h2>
            <p className="text-ink-soft leading-relaxed">{summary.summary_text}</p>
            <p className="text-xs text-ink-muted mt-3">
              Updated {new Date(summary.generated_at).toLocaleDateString()}
            </p>
          </section>
        )}

        <section className="card p-6">
          <h2 className="text-xl font-bold mb-2">Privacy</h2>
          <p className="text-ink-soft text-sm mb-4">
            Real Food Win never sells, shares, or monetizes your data.
          </p>
          <div className="flex flex-wrap gap-2">
            <button className="btn-secondary py-2" disabled>Download my data</button>
            <button className="btn-secondary py-2" disabled>Delete my account</button>
          </div>
          <p className="text-xs text-ink-muted mt-2">Privacy controls ship with Phase 1 launch.</p>
        </section>

        <form action="/api/auth/signout" method="post">
          <button type="submit" className="btn-ghost">Sign out →</button>
        </form>
      </main>
    </>
  );
}
