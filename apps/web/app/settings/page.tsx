import Link from "next/link";
import { Nav } from "@/components/Nav";
import { redirect } from "next/navigation";
import { createSupabaseServer } from "@/lib/supabase/server";
import { ProfileEditor } from "@/components/ProfileEditor";
import { AboutYouEditor } from "@/components/AboutYouEditor";

export default async function SettingsPage() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/sign-in?next=" + encodeURIComponent("/settings"));

  const { data: userRow } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();

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

  const initial = {
    dietary_pattern: (profile?.dietary_pattern as string[] | null) ?? [],
    allergies: (profile?.allergies as string[] | null) ?? [],
    allergies_other:
      ((profile?.extra as { allergies_other?: string | null } | null)?.allergies_other as string | null) ?? "",
    household_composition: (profile?.household_composition as string | null) ?? null,
    top_goal: (profile?.top_goal as string | null) ?? null,
    weeknight_time: (profile?.weeknight_time as number | null) ?? null,
    skill_level: (profile?.skill_level as "beginner" | "comfortable" | "confident" | null) ?? null,
  };

  return (
    <>
      <Nav />
      <main className="max-w-3xl mx-auto px-6 py-12 space-y-10">
        <header>
          <h1 className="text-4xl font-bold tracking-tight text-paper">Account</h1>
          <p className="text-paper/80 mt-1">
            Signed in as <strong>{(userRow?.display_name as string | undefined)?.trim() || user.email}</strong>
          </p>
        </header>

        {!profile && (
          <section className="card p-6">
            <p className="text-ink-muted">
              No profile yet — <Link href="/quiz" className="text-sunrise underline">take the quiz</Link> to get started, or set your preferences below.
            </p>
          </section>
        )}

        <ProfileEditor initial={initial} />

        <AboutYouEditor
          initialText={summary?.summary_text ?? ""}
          generatedAt={summary?.generated_at ?? null}
        />

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
