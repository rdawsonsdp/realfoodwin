import { getServiceSupabase } from "./supabase.js";

// TODO: swap these `any` shapes for imports from @realfoodwin/types once the
// types package is finalized. They are intentionally permissive here so we
// can build the gateway in parallel with the types package.

export interface UserContext {
  profile: Record<string, unknown> | null;
  household: Record<string, unknown> | null;
  householdMembers: Record<string, unknown>[];
  summary: string | null;
  recentWins: string[];
  recentMisses: string[];
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
    };
  }

  const sb = getServiceSupabase();

  const [profileRes, userRes, summaryRes, winsRes, missesRes] = await Promise.all([
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

  return {
    profile: profileRes.data ?? null,
    household,
    householdMembers,
    summary: (summaryRes.data as { summary_text?: string } | null)?.summary_text ?? null,
    recentWins: (winsRes.data ?? []).map(describeEvent),
    recentMisses: (missesRes.data ?? []).map(describeEvent),
  };
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
  return lines.join("\n");
}
