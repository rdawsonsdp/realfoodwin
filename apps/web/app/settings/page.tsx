import Link from "next/link";
import { Nav } from "@/components/Nav";
import { ProfileEditor, type ProfileEditorValue } from "@/components/ProfileEditor";
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
          <h1 className="text-4xl font-bold tracking-tight text-paper">Account</h1>
          <p className="text-paper/80 mt-1">Signed in as <strong>{user.email}</strong></p>
        </header>

        {profile ? (
          <ProfileEditor
            initial={{
              dietary_pattern: profile.dietary_pattern ?? [],
              allergies: profile.allergies ?? [],
              allergies_other:
                (profile.extra as { allergies_other?: string | null } | null)?.allergies_other ?? "",
              household_composition: profile.household_composition ?? null,
              top_goal: profile.top_goal ?? null,
              weeknight_time: profile.weeknight_time ?? null,
              skill_level: (profile.skill_level as ProfileEditorValue["skill_level"]) ?? null,
            }}
          />
        ) : (
          <section className="card p-6">
            <h2 className="text-xl font-bold mb-2">Your profile</h2>
            <p className="text-ink-muted">
              No profile yet — <Link href="/quiz" className="text-sunrise underline">take the quiz</Link>.
            </p>
          </section>
        )}

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
          <button type="submit" className="btn-ghost-on-dark">Sign out →</button>
        </form>
      </main>
    </>
  );
}
