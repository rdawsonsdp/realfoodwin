// Coach memory — the layer that lets the agent learn each user.
//
// Two storage layers (see migrations/0011_coach_memory.sql):
//   1. user_coach_memories — append-only granular fact log. Truth source.
//   2. user_profiles.coach_memory_summary — synthesized jsonb summary
//      injected into every prompt. Rebuilt after each new fact.
//
// All helpers here are server-side. Writes go through the service-role client
// so we can flip `active` flags when superseding without weakening RLS.

import { createClient } from "@supabase/supabase-js";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireEnv } from "@/lib/env";
import { callText } from "@realfoodwin/gateway";

// ----------------------------- shape -----------------------------------

export type MemoryType =
  | "like"
  | "dislike"
  | "allergy"
  | "constraint"
  | "theme"
  | "goal"
  | "win";

export interface CoachMemory {
  id: string;
  user_id: string;
  memory_type: MemoryType;
  subject: string;
  detail: Record<string, unknown>;
  source: string;
  confidence: "low" | "medium" | "high";
  active: boolean;
  superseded_by: string | null;
  source_turn_id: string | null;
  created_at: string;
}

export interface CoachMemorySummary {
  likes: { subject: string; note?: string | null }[];
  dislikes: { subject: string; note?: string | null }[];
  constraints: { subject: string; note?: string | null }[];
  themes: { subject: string; note?: string | null }[];
  recent_wins: { subject: string; note?: string | null }[];
  updated_at: string;
}

// ----------------------------- clients ---------------------------------

function admin() {
  // Service role client — bypasses RLS so we can flip `active` flags.
  return createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );
}

// ----------------------------- read ------------------------------------

export async function getActiveMemories(userId: string): Promise<CoachMemory[]> {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("user_coach_memories")
    .select("*")
    .eq("user_id", userId)
    .eq("active", true)
    .order("created_at", { ascending: false });
  return (data as CoachMemory[] | null) ?? [];
}

export async function getMemorySummary(
  userId: string,
): Promise<CoachMemorySummary | null> {
  const supabase = createSupabaseServer();
  const { data } = await supabase
    .from("user_profiles")
    .select("coach_memory_summary")
    .eq("user_id", userId)
    .maybeSingle();
  return (
    (data as { coach_memory_summary: CoachMemorySummary | null } | null)
      ?.coach_memory_summary ?? null
  );
}

// ----------------------------- write -----------------------------------

interface AddMemoryArgs {
  userId: string;
  memoryType: MemoryType;
  subject: string;
  detail?: Record<string, unknown>;
  source?: string;
  confidence?: "low" | "medium" | "high";
  sourceTurnId?: string | null;
  // Optional supersede target — when the user changes their mind. The old
  // memory is flipped `active=false` and its `superseded_by` is set.
  supersedesId?: string | null;
}

export async function addMemory(args: AddMemoryArgs): Promise<CoachMemory> {
  const a = admin();
  const { data, error } = await a
    .from("user_coach_memories")
    .insert({
      user_id: args.userId,
      memory_type: args.memoryType,
      subject: args.subject,
      detail: args.detail ?? {},
      source: args.source ?? "coach_chat",
      confidence: args.confidence ?? "medium",
      source_turn_id: args.sourceTurnId ?? null,
    })
    .select()
    .single();
  if (error) throw new Error(`addMemory failed: ${error.message}`);

  // If this memory supersedes another, flip the old one's active flag.
  if (args.supersedesId) {
    await a
      .from("user_coach_memories")
      .update({ active: false, superseded_by: (data as CoachMemory).id })
      .eq("id", args.supersedesId)
      .eq("user_id", args.userId);
  }

  return data as CoachMemory;
}

// Mark a memory inactive without writing a replacement. Used when the user
// explicitly retracts ("actually never mind, I do like that").
export async function retractMemory(userId: string, memoryId: string): Promise<void> {
  const a = admin();
  await a
    .from("user_coach_memories")
    .update({ active: false })
    .eq("id", memoryId)
    .eq("user_id", userId);
}

// ----------------------------- synthesize ------------------------------

// Rebuild the prompt-ready summary jsonb from the active memories.
// Called after every new memory write. Cheap Haiku call, ~$0.0001/turn.
export async function rebuildMemorySummary(userId: string): Promise<CoachMemorySummary> {
  const memories = await getActiveMemories(userId);

  if (memories.length === 0) {
    const empty: CoachMemorySummary = {
      likes: [],
      dislikes: [],
      constraints: [],
      themes: [],
      recent_wins: [],
      updated_at: new Date().toISOString(),
    };
    await admin()
      .from("user_profiles")
      .update({ coach_memory_summary: empty })
      .eq("user_id", userId);
    return empty;
  }

  // For very small memory sets, skip the LLM and just bucket directly.
  // Only call Haiku once we have enough that synthesis adds real value
  // (deduping similar items, picking which "themes" matter most).
  if (memories.length < 6) {
    const summary = bucketMemoriesDirectly(memories);
    await admin()
      .from("user_profiles")
      .update({ coach_memory_summary: summary })
      .eq("user_id", userId);
    return summary;
  }

  // Larger memory set — let Haiku consolidate.
  const facts = memories
    .map((m) => {
      const noteParts: string[] = [];
      if (m.detail && typeof m.detail === "object") {
        for (const [k, v] of Object.entries(m.detail)) {
          if (typeof v === "string") noteParts.push(`${k}: ${v}`);
        }
      }
      return `- [${m.memory_type}] ${m.subject}${
        noteParts.length ? ` (${noteParts.join("; ")})` : ""
      }`;
    })
    .join("\n");

  const system = `You synthesize a user profile summary for a real-food coaching app.
Given a list of remembered facts, group them into likes / dislikes / constraints / themes / recent_wins.
Dedupe near-duplicates, prefer the more specific phrasing, and drop low-signal items.
Return ONLY valid JSON matching this exact shape:
{"likes":[{"subject":"...","note":"..."}],"dislikes":[{"subject":"...","note":"..."}],"constraints":[{"subject":"...","note":"..."}],"themes":[{"subject":"...","note":"..."}],"recent_wins":[{"subject":"...","note":"..."}]}
Keep arrays short — at most 6 items each.`;

  const { text } = await callText({
    tier: "haiku",
    system,
    user: `Facts to synthesize:\n${facts}`,
    maxTokens: 800,
    temperature: 0.2,
  });

  let parsed: Partial<CoachMemorySummary> = {};
  try {
    // Defensive — pull the first {...} block in case the model prefaces.
    const match = text.match(/\{[\s\S]*\}/);
    parsed = match ? JSON.parse(match[0]) : {};
  } catch {
    // Fall back to the direct bucketing if the model gave us garbage.
    parsed = bucketMemoriesDirectly(memories);
  }

  const summary: CoachMemorySummary = {
    likes: parsed.likes ?? [],
    dislikes: parsed.dislikes ?? [],
    constraints: parsed.constraints ?? [],
    themes: parsed.themes ?? [],
    recent_wins: parsed.recent_wins ?? [],
    updated_at: new Date().toISOString(),
  };

  await admin()
    .from("user_profiles")
    .update({ coach_memory_summary: summary })
    .eq("user_id", userId);

  return summary;
}

function bucketMemoriesDirectly(memories: CoachMemory[]): CoachMemorySummary {
  const bucket = {
    likes: [] as { subject: string; note?: string | null }[],
    dislikes: [] as { subject: string; note?: string | null }[],
    constraints: [] as { subject: string; note?: string | null }[],
    themes: [] as { subject: string; note?: string | null }[],
    recent_wins: [] as { subject: string; note?: string | null }[],
  };
  for (const m of memories) {
    const note =
      (m.detail && typeof m.detail === "object"
        ? (m.detail as Record<string, unknown>)["note"]
        : null) as string | null;
    const entry = { subject: m.subject, note: note ?? null };
    switch (m.memory_type) {
      case "like":
        bucket.likes.push(entry);
        break;
      case "dislike":
      case "allergy":
        bucket.dislikes.push(entry);
        break;
      case "constraint":
        bucket.constraints.push(entry);
        break;
      case "theme":
      case "goal":
        bucket.themes.push(entry);
        break;
      case "win":
        bucket.recent_wins.push(entry);
        break;
    }
  }
  return { ...bucket, updated_at: new Date().toISOString() };
}

// ----------------------------- prompt context --------------------------

// Render the memory summary as a short prompt-ready block. Empty string when
// the summary is null/empty so callers can `${memoryContextBlock(...)}` without
// emitting boilerplate for cold-start users.
export function memoryContextBlock(summary: CoachMemorySummary | null): string {
  if (!summary) return "";
  const lines: string[] = [];
  const fmt = (
    label: string,
    items: { subject: string; note?: string | null }[],
  ) => {
    if (items.length === 0) return;
    const rendered = items
      .map((i) => (i.note ? `${i.subject} (${i.note})` : i.subject))
      .join(", ");
    lines.push(`${label}: ${rendered}`);
  };
  fmt("Likes", summary.likes);
  fmt("Dislikes", summary.dislikes);
  fmt("Constraints", summary.constraints);
  fmt("Themes", summary.themes);
  fmt("Recent wins", summary.recent_wins);
  if (lines.length === 0) return "";
  return `What I know about this user so far:\n${lines.join("\n")}`;
}
