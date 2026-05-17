import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import { CoachingNotes } from "@/components/CoachingNotes";

export const dynamic = "force-dynamic";

interface SwapOutput {
  title?: string;
  tagline?: string;
  narrative?: string;
  tuned_for_you_reasons?: string[];
  recipe?: { title?: string };
}

export default async function AdminIntelligencePage() {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data: users } = await admin
    .from("users")
    .select("id, email, display_name")
    .order("email");

  if (!users || users.length === 0) {
    return <p className="text-paper/70">No users yet.</p>;
  }

  return (
    <div className="space-y-6">
      <p className="text-paper/80 text-sm">
        How the Swap Generator is personalizing for each user. Profile + summary + recent ratings + admin coaching all feed into every prompt. The "Tuned for you" reasons are pulled verbatim from the latest agent output.
      </p>

      {await Promise.all(users.map((u) => (
        <PersonaIntelligenceCard
          key={u.id}
          userId={u.id}
          email={u.email}
          displayName={u.display_name}
          admin={admin}
        />
      )))}
    </div>
  );
}

interface Household {
  name: string;
  age_range: string | null;
  allergies: string[] | null;
}
interface Rating {
  stars: number;
  target_label: string | null;
}
interface Swap {
  id: string;
  swap_target: string | null;
  output: SwapOutput | null;
  recipe: { title?: string } | null;
  narrative: string | null;
  created_at: string;
}
interface CoachingNote {
  id: string;
  note: string;
  active: boolean;
  updated_at: string;
}

async function PersonaIntelligenceCard({
  userId,
  email,
  displayName,
  admin,
}: {
  userId: string;
  email: string;
  displayName: string | null;
  admin: SupabaseClient;
}) {
  const userRow = await admin.from("users").select("household_id").eq("id", userId).single();
  const householdId = (userRow.data as { household_id?: string } | null)?.household_id ?? "";

  const [profileRes, summaryRes, latestSwapsRes, topRatedRes, householdRes, coachingRes] = await Promise.all([
    admin.from("user_profiles").select("*").eq("user_id", userId).maybeSingle(),
    admin.from("user_summaries").select("summary_text, generated_at").eq("user_id", userId).maybeSingle(),
    admin
      .from("swaps")
      .select("id, swap_target, output, recipe, narrative, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(3),
    admin
      .from("recipe_ratings")
      .select("stars, target_label")
      .eq("user_id", userId)
      .gte("stars", 4)
      .order("updated_at", { ascending: false })
      .limit(5),
    householdId
      ? admin
          .from("household_member_profiles")
          .select("name, age_range, allergies")
          .eq("household_id", householdId)
      : Promise.resolve({ data: [] as Household[] }),
    admin
      .from("admin_coaching_notes")
      .select("id, note, active, updated_at")
      .eq("target_user_id", userId)
      .order("updated_at", { ascending: false }),
  ]);

  const profile = profileRes.data as Record<string, unknown> | null;
  const summary = (summaryRes.data as { summary_text?: string } | null)?.summary_text;
  const latest = (latestSwapsRes.data ?? []) as Swap[];
  const topRated = (topRatedRes.data ?? []) as Rating[];
  const household = (householdRes.data ?? []) as Household[];
  const coachingNotes = (coachingRes.data ?? []) as CoachingNote[];
  const cuisines = Array.isArray(profile?.cuisine_affinity)
    ? (profile!.cuisine_affinity as string[])
    : [];

  return (
    <article className="card overflow-hidden">
      <header className="px-6 py-4 bg-gradient-to-br from-honey/20 via-cream to-paper flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold">{displayName ?? email}</h2>
          <p className="text-xs text-ink-muted">{email}</p>
        </div>
        <span className="text-xs text-ink-muted">
          {latest.length} recent {latest.length === 1 ? "swap" : "swaps"} shown
        </span>
      </header>

      <div className="grid lg:grid-cols-2 gap-px bg-ink/5">
        {/* Left: context the AI sees */}
        <div className="bg-white p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-sunrise-700">
            Context the AI sees on every call
          </h3>

          {profile && (
            <ContextBlock title="<user_profile>">
              <dl className="grid grid-cols-2 gap-y-1 text-sm">
                {Array.isArray(profile.dietary_pattern) && profile.dietary_pattern.length > 0 && (
                  <>
                    <dt className="text-ink-muted">Dietary</dt>
                    <dd>{(profile.dietary_pattern as string[]).join(", ")}</dd>
                  </>
                )}
                {Array.isArray(profile.allergies) && profile.allergies.length > 0 && (
                  <>
                    <dt className="text-ink-muted">Allergies</dt>
                    <dd className="text-coral font-semibold">{(profile.allergies as string[]).join(", ")}</dd>
                  </>
                )}
                {profile.household_composition ? (
                  <>
                    <dt className="text-ink-muted">Household</dt>
                    <dd>{profile.household_composition as string}</dd>
                  </>
                ) : null}
                {profile.top_goal ? (
                  <>
                    <dt className="text-ink-muted">Goal</dt>
                    <dd>{profile.top_goal as string}</dd>
                  </>
                ) : null}
                {profile.weeknight_time ? (
                  <>
                    <dt className="text-ink-muted">Weeknight</dt>
                    <dd>{String(profile.weeknight_time)} min</dd>
                  </>
                ) : null}
                {profile.skill_level ? (
                  <>
                    <dt className="text-ink-muted">Skill</dt>
                    <dd>{profile.skill_level as string}</dd>
                  </>
                ) : null}
              </dl>
            </ContextBlock>
          )}

          {cuisines.length > 0 && (
            <ContextBlock title="<cuisine_affinity>">
              <p className="text-sm">{cuisines.join(", ")}</p>
            </ContextBlock>
          )}

          {household.length > 0 && (
            <ContextBlock title="<household_context>">
              <ul className="space-y-1 text-sm">
                {household.map((m, i) => (
                  <li key={i}>
                    <strong>{m.name}</strong>{" "}
                    <span className="text-ink-muted">
                      ({m.age_range ?? "?"})
                      {m.allergies && m.allergies.length > 0 && (
                        <span className="text-coral">
                          {" "} · allergies: {m.allergies.join(", ")}
                        </span>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            </ContextBlock>
          )}

          {summary && (
            <ContextBlock title="<what_we_know_about_user>">
              <p className="text-sm text-ink-soft leading-relaxed italic">
                {summary}
              </p>
            </ContextBlock>
          )}

          {topRated.length > 0 && (
            <ContextBlock title="<top_rated_by_user>">
              <ul className="text-sm space-y-1">
                {topRated.map((r, i) => (
                  <li key={i}>
                    <span className="text-sunrise font-bold">{r.stars}/5</span>{" "}
                    <span className="text-ink-soft">— {r.target_label ?? "(unnamed)"}</span>
                  </li>
                ))}
              </ul>
            </ContextBlock>
          )}

          {coachingNotes.filter((c) => c.active).length > 0 && (
            <ContextBlock title="<admin_coaching_notes>">
              <ul className="text-sm space-y-1.5">
                {coachingNotes.filter((c) => c.active).map((c) => (
                  <li key={c.id} className="text-ink-soft">
                    <span className="text-sunrise mr-1">▸</span>
                    {c.note}
                  </li>
                ))}
              </ul>
            </ContextBlock>
          )}

          {!profile && !summary && (
            <p className="text-sm text-ink-muted italic">
              No profile yet. The AI will treat this user as anonymous until they take the quiz.
            </p>
          )}
        </div>

        {/* Right: what the AI actually produced */}
        <div className="bg-white p-6 space-y-4">
          <h3 className="text-xs font-bold uppercase tracking-[0.15em] text-sunrise-700">
            Latest "Tuned for you" reasoning
          </h3>

          {latest.length === 0 ? (
            <p className="text-sm text-ink-muted italic">No swaps yet for this user.</p>
          ) : (
            latest.map((s) => {
              const output = (s.output ?? null) as SwapOutput | null;
              const reasons = output?.tuned_for_you_reasons ?? [];
              const altTitle =
                output?.title ?? s.recipe?.title ?? "(no title preserved)";
              const original = s.swap_target ?? "—";
              return (
                <div
                  key={s.id}
                  className="border-l-4 border-sunrise pl-4 py-1"
                >
                  <div className="text-xs text-ink-muted mb-1.5">
                    {new Date(s.created_at).toLocaleString()}
                  </div>
                  <p className="text-base font-bold text-ink mb-2 leading-snug">
                    <span className="text-coral">{original}</span>
                    <span className="text-ink-muted mx-1.5">→</span>
                    <span>{altTitle}</span>
                  </p>
                  {reasons.length > 0 ? (
                    <ul className="space-y-1 text-sm text-ink-soft">
                      {reasons.map((r: string, i: number) => (
                        <li key={i}>
                          <span className="text-sunrise">▸</span> {r}
                        </li>
                      ))}
                    </ul>
                  ) : s.narrative ? (
                    <p className="text-sm text-ink-soft line-clamp-3 italic">
                      {s.narrative}
                    </p>
                  ) : (
                    <p className="text-xs text-ink-muted italic">
                      No reasoning preserved for this swap.
                    </p>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>

      <CoachingNotes targetUserId={userId} initialNotes={coachingNotes} />
    </article>
  );
}

function ContextBlock({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-mono text-sunrise-700 mb-1.5">{title}</div>
      <div className="pl-3 border-l-2 border-honey">{children}</div>
    </div>
  );
}
