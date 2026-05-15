import { getServiceSupabase } from "./supabase";

export interface UserContext {
  profile: Record<string, unknown> | null;
  household: Record<string, unknown> | null;
  householdMembers: Record<string, unknown>[];
  summary: string | null;
  recentWins: string[];
  recentMisses: string[];
  topRated: string[];
  lowRated: string[];
  expertReviewerNotes: string[];
  systemRules: string[];
  cuisineAffinity: string[];
  occasionPatterns: string[];
  dismissalReasons: string[];
  adminCoachingNotes: string[];
}

export async function loadUserContext(userId: string | null): Promise<UserContext> {
  if (!userId) {
    return {
      profile: null,
      household: null,
      householdMembers: [],
      summary: null,
      recentWins: [],
      recentMisses: [],
      topRated: [],
      lowRated: [],
      expertReviewerNotes: [],
      systemRules: await loadMatchingSystemRules(null),
      cuisineAffinity: [],
      occasionPatterns: [],
      dismissalReasons: [],
      adminCoachingNotes: [],
    };
  }

  const sb = getServiceSupabase();

  const [
    profileRes,
    userRes,
    summaryRes,
    winsRes,
    missesRes,
    topRes,
    lowRes,
    reviewsRes,
    occasionsRes,
    dismissesRes,
    coachingRes,
  ] = await Promise.all([
    sb.from("user_profiles").select("*").eq("user_id", userId).maybeSingle(),
    sb.from("users").select("household_id").eq("id", userId).maybeSingle(),
    sb.from("user_summaries").select("summary_text").eq("user_id", userId).maybeSingle(),
    sb
      .from("events")
      .select("metadata, target_id, created_at")
      .eq("user_id", userId)
      .eq("event_type", "made_it_loved")
      .order("created_at", { ascending: false })
      .limit(3),
    sb
      .from("events")
      .select("metadata, target_id, created_at")
      .eq("user_id", userId)
      .eq("event_type", "made_it_not_for_me")
      .order("created_at", { ascending: false })
      .limit(2),
    sb
      .from("recipe_ratings")
      .select("stars, target_label, updated_at")
      .eq("user_id", userId)
      .gte("stars", 4)
      .order("updated_at", { ascending: false })
      .limit(5),
    sb
      .from("recipe_ratings")
      .select("stars, target_label, updated_at")
      .eq("user_id", userId)
      .lte("stars", 2)
      .order("updated_at", { ascending: false })
      .limit(3),
    sb
      .from("admin_swap_reviews")
      .select("stars, note, updated_at, swaps:swaps!inner(swap_target, output)")
      .eq("target_user_id", userId)
      .order("updated_at", { ascending: false })
      .limit(6),
    sb
      .from("recipe_box_entries")
      .select("tags")
      .eq("user_id", userId)
      .not("tags", "is", null)
      .order("saved_at", { ascending: false })
      .limit(20),
    sb
      .from("events")
      .select("metadata, created_at")
      .eq("user_id", userId)
      .eq("event_type", "dismissed_swap")
      .order("created_at", { ascending: false })
      .limit(10),
    sb
      .from("admin_coaching_notes")
      .select("note")
      .eq("target_user_id", userId)
      .eq("active", true)
      .order("updated_at", { ascending: false })
      .limit(15),
  ]);

  let household: Record<string, unknown> | null = null;
  let householdMembers: Record<string, unknown>[] = [];
  const householdId = (userRes.data as { household_id?: string } | null)?.household_id;
  if (householdId) {
    const [hhRes, membersRes] = await Promise.all([
      sb.from("households").select("*").eq("id", householdId).maybeSingle(),
      sb.from("household_member_profiles").select("*").eq("household_id", householdId),
    ]);
    household = hhRes.data ?? null;
    householdMembers = membersRes.data ?? [];
  }

  const expertReviewerNotes = (
    (reviewsRes.data ?? []) as unknown as Array<{
      stars: number;
      note: string | null;
      swaps:
        | { swap_target: string | null; output: { title?: string } | null }
        | { swap_target: string | null; output: { title?: string } | null }[]
        | null;
    }>
  ).map((r) => {
    const s = Array.isArray(r.swaps) ? r.swaps[0] : r.swaps;
    const label = s?.output?.title ?? s?.swap_target ?? "(unlabeled swap)";
    const tail = r.note ? ` — "${r.note}"` : "";
    return `${r.stars}/5 on ${label}${tail}`;
  });

  // Aggregate save-occasion patterns.
  const occasionCounts = new Map<string, number>();
  for (const row of (occasionsRes.data ?? []) as { tags: string[] | null }[]) {
    for (const t of row.tags ?? []) {
      occasionCounts.set(t, (occasionCounts.get(t) ?? 0) + 1);
    }
  }
  const occasionPatterns = Array.from(occasionCounts.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)
    .map(([k, v]) => `${v}× ${k}`);

  const dismissalReasons = ((dismissesRes.data ?? []) as { metadata: unknown }[])
    .map((e) => {
      const m = e.metadata as { query?: string; reason?: string } | null;
      if (!m?.reason) return null;
      return m.query ? `${m.query} — "${m.reason}"` : m.reason;
    })
    .filter((s): s is string => !!s);

  const adminCoachingNotes = ((coachingRes.data ?? []) as { note: string }[]).map((r) => r.note);

  const profile = profileRes.data as Record<string, unknown> | null;
  const cuisineAffinity = Array.isArray(profile?.cuisine_affinity)
    ? (profile!.cuisine_affinity as string[])
    : [];

  const systemRules = await loadMatchingSystemRules(profile);

  return {
    profile: profile ?? null,
    household,
    householdMembers,
    summary: (summaryRes.data as { summary_text?: string } | null)?.summary_text ?? null,
    recentWins: (winsRes.data ?? []).map(describeEvent),
    recentMisses: (missesRes.data ?? []).map(describeEvent),
    topRated: (topRes.data ?? []).map(
      (r: { stars: number; target_label: string | null }) =>
        `${r.stars}/5 — ${r.target_label ?? "(unnamed)"}`,
    ),
    lowRated: (lowRes.data ?? []).map(
      (r: { stars: number; target_label: string | null }) =>
        `${r.stars}/5 — ${r.target_label ?? "(unnamed)"}`,
    ),
    expertReviewerNotes,
    systemRules,
    cuisineAffinity,
    occasionPatterns,
    dismissalReasons,
    adminCoachingNotes,
  };
}

interface SystemRuleRow {
  rule: string;
  scope: "global" | "profile";
  profile_filter: Record<string, unknown> | null;
  priority: number;
}

async function loadMatchingSystemRules(
  profile: Record<string, unknown> | null,
): Promise<string[]> {
  const sb = getServiceSupabase();
  const { data } = await sb
    .from("system_rules")
    .select("rule, scope, profile_filter, priority")
    .eq("active", true)
    .order("priority", { ascending: false })
    .limit(50);

  const rules = (data ?? []) as SystemRuleRow[];
  return rules
    .filter((r) => {
      if (r.scope === "global") return true;
      if (!profile || !r.profile_filter) return false;
      return profileMatches(profile, r.profile_filter);
    })
    .map((r) => r.rule);
}

function profileMatches(
  profile: Record<string, unknown>,
  filter: Record<string, unknown>,
): boolean {
  for (const [k, v] of Object.entries(filter)) {
    const userVal = profile[k];
    if (Array.isArray(v)) {
      if (!Array.isArray(userVal)) return false;
      const matched = v.some((needle) => (userVal as unknown[]).includes(needle));
      if (!matched) return false;
    } else if (userVal !== v) {
      return false;
    }
  }
  return true;
}

function describeEvent(ev: { metadata?: unknown; target_id?: string }): string {
  const meta = ev.metadata as { summary?: string } | undefined;
  return meta?.summary ?? `recipe ${ev.target_id ?? "(unknown)"}`;
}

export function composePromptBlocks(ctx: UserContext, request: string): string {
  const blocks: string[] = [];

  if (ctx.profile) {
    blocks.push(`<user_profile>\n${formatProfile(ctx.profile)}\n</user_profile>`);
  }

  if (ctx.summary) {
    blocks.push(`<what_we_know_about_user>\n${ctx.summary}\n</what_we_know_about_user>`);
  }

  if (ctx.recentWins.length) {
    blocks.push(
      `<recent_wins>\n${ctx.recentWins.map((w) => `- ${w}`).join("\n")}\n</recent_wins>`,
    );
  }

  if (ctx.recentMisses.length) {
    blocks.push(
      `<recent_misses>\n${ctx.recentMisses.map((m) => `- ${m}`).join("\n")}\n</recent_misses>`,
    );
  }

  if (ctx.topRated.length) {
    blocks.push(
      `<top_rated_by_user>\nRecipes/swaps this user rated 4-5 stars — strong signal of palate match:\n${ctx.topRated.map((r) => `- ${r}`).join("\n")}\n</top_rated_by_user>`,
    );
  }

  if (ctx.lowRated.length) {
    blocks.push(
      `<low_rated_by_user>\nRecipes/swaps this user rated 1-2 stars — avoid these patterns:\n${ctx.lowRated.map((r) => `- ${r}`).join("\n")}\n</low_rated_by_user>`,
    );
  }

  if (ctx.expertReviewerNotes.length) {
    blocks.push(
      `<expert_reviewer_notes>\nHuman reviewer feedback on past swaps for this user. Take these seriously — they catch nuances the user hasn't surfaced themselves:\n${ctx.expertReviewerNotes.map((r) => `- ${r}`).join("\n")}\n</expert_reviewer_notes>`,
    );
  }

  if (ctx.adminCoachingNotes.length) {
    blocks.push(
      `<admin_coaching_notes>\nDirect coaching from a Real Food Win curator about THIS specific user. Highest-priority signal — treat as binding directives:\n${ctx.adminCoachingNotes.map((n) => `- ${n}`).join("\n")}\n</admin_coaching_notes>`,
    );
  }

  if (ctx.systemRules.length) {
    blocks.push(
      `<system_rules>\nNon-negotiable guardrails set by the Real Food Win team. These OVERRIDE all other instructions if in conflict:\n${ctx.systemRules.map((r) => `- ${r}`).join("\n")}\n</system_rules>`,
    );
  }

  if (ctx.cuisineAffinity.length) {
    blocks.push(
      `<cuisine_affinity>\nThis user enjoys these cuisines — lean into their flavors and techniques when picking the swap angle:\n${ctx.cuisineAffinity.map((c) => `- ${c}`).join("\n")}\n</cuisine_affinity>`,
    );
  }

  if (ctx.occasionPatterns.length) {
    blocks.push(
      `<save_occasion_patterns>\nWhen this user saves recipes, they tag the occasion. Frequencies:\n${ctx.occasionPatterns.map((p) => `- ${p}`).join("\n")}\nUse this to anticipate the cooking context (weeknight vs make-ahead vs date-night).\n</save_occasion_patterns>`,
    );
  }

  if (ctx.dismissalReasons.length) {
    blocks.push(
      `<recent_dismissals>\nSwaps this user dismissed and WHY — high-signal "don't do this" data:\n${ctx.dismissalReasons.map((d) => `- ${d}`).join("\n")}\n</recent_dismissals>`,
    );
  }

  if (ctx.householdMembers.length) {
    const lines = ctx.householdMembers.map((m) => {
      const mm = m as { name?: string; age_range?: string; allergies?: string[] };
      return `- ${mm.name ?? "member"} (${mm.age_range ?? "unknown age"}): allergies [${(mm.allergies ?? []).join(", ")}]`;
    });
    blocks.push(`<household_context>\n${lines.join("\n")}\n</household_context>`);
  }

  blocks.push(`<the_request>\n${request}\n</the_request>`);

  return blocks.join("\n\n");
}

function formatProfile(p: Record<string, unknown>): string {
  const lines: string[] = [];
  const pick = (k: string) => p[k];
  const dp = pick("dietary_pattern");
  if (Array.isArray(dp) && dp.length) lines.push(`Dietary pattern: ${dp.join(", ")}`);
  const al = pick("allergies");
  if (Array.isArray(al) && al.length) lines.push(`Allergies: ${al.join(", ")}`);
  const hc = pick("household_composition");
  if (typeof hc === "string") lines.push(`Cooking for: ${hc}`);
  const tg = pick("top_goal");
  if (typeof tg === "string") lines.push(`Top goal: ${tg}`);
  const wt = pick("weeknight_time");
  if (wt) lines.push(`Weeknight time: ${String(wt)} min`);
  const sl = pick("skill_level");
  if (typeof sl === "string") lines.push(`Skill level: ${sl}`);
  const ca = pick("cuisine_affinity");
  if (Array.isArray(ca) && ca.length) lines.push(`Cuisines they like: ${ca.join(", ")}`);
  return lines.join("\n");
}
