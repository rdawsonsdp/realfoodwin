import { createSupabaseServer } from "@/lib/supabase/server";
import { buildGreeting } from "@/lib/coach";

// Personalized hero for signed-in users. Shares the produce-bag backdrop with
// the anonymous HeroSplash so the page feels like one home — only the message
// changes once we know who's looking.

export async function CoachGreeting() {
  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const [userRowRes, profileRes] = await Promise.all([
    supabase.from("users").select("display_name").eq("id", user.id).maybeSingle(),
    supabase.from("user_profiles").select("top_goal").eq("user_id", user.id).maybeSingle(),
  ]);
  const displayName =
    (userRowRes.data as { display_name?: string | null } | null)?.display_name ?? null;
  const topGoal =
    (profileRes.data as { top_goal?: string | null } | null)?.top_goal ?? null;

  const greeting = buildGreeting({
    displayName,
    email: user.email,
    topGoal,
  });

  return (
    <section className="relative overflow-hidden rounded-soft mb-12 ring-1 ring-ink/5 shadow-card bg-paper">
      {/* Full-bleed produce backdrop, same as anonymous home */}
      <div className="absolute inset-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src="/images/hero-fresh-bag.webp"
          alt=""
          aria-hidden
          className="w-full h-full object-cover"
          loading="eager"
        />
        <div
          aria-hidden
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(115deg, rgba(255,243,214,0.7) 0%, rgba(255,213,107,0.20) 35%, rgba(255,255,255,0) 60%, rgba(26,26,46,0.20) 100%)",
          }}
        />
      </div>

      {/* Oversized backdrop wordmark */}
      <div
        aria-hidden
        className="absolute inset-x-0 top-4 md:top-6 px-6 md:px-12 select-none pointer-events-none"
      >
        <h1
          className="font-black tracking-[-0.04em] leading-[0.85] text-ink/80 mix-blend-multiply"
          style={{ fontSize: "clamp(48px, 11vw, 150px)" }}
        >
          REAL <span className="text-sunrise-700">FOOD</span> WIN
        </h1>
      </div>

      {/* Personalized glass card */}
      <div className="relative px-6 md:px-12 pt-[34vw] md:pt-[22vw] lg:pt-[18vw] pb-8">
        <div className="max-w-xl bg-white/85 backdrop-blur-sm rounded-soft p-6 md:p-7 shadow-card ring-1 ring-ink/5 animate-fade-up">
          <p className="text-xs uppercase tracking-[0.18em] text-sunrise-700 font-semibold mb-2">
            Welcome back
          </p>
          <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight text-ink">
            {greeting.headline}
          </h2>
          <p className="text-lg md:text-xl text-ink-soft mt-3 italic leading-snug">
            {greeting.prompt}
          </p>
        </div>
      </div>
    </section>
  );
}
