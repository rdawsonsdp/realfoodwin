/**
 * 30-day test harness for Real Food Win.
 *
 * Creates 5 personas, runs 5 real Sonnet swaps per persona per day for 30 days,
 * with realistic saves, iterations, made-it events, and dismissals — all
 * timestamped across the past 30 days so the Kitchen / Scorecard / RAG retrieval
 * all see real data spread over time.
 *
 * Run: corepack pnpm tsx scripts/seed-personas.ts
 */

import "dotenv/config";
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });

import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import {
  runSwapGenerator,
  runRecipeIterator,
  runQuizSummary,
} from "@realfoodwin/gateway";
import { PERSONAS, makeRng, pickRandom, type Persona } from "./personas";

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SERVICE_ROLE = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!SUPABASE_URL || !SERVICE_ROLE) {
  console.error("Missing env: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY");
  process.exit(1);
}

const admin: SupabaseClient = createClient(SUPABASE_URL, SERVICE_ROLE, {
  auth: { persistSession: false, autoRefreshToken: false },
});

const DAYS = 30;
const NOW = new Date();
const startOfDay = (offsetDaysAgo: number) => {
  const d = new Date(NOW);
  d.setDate(d.getDate() - offsetDaysAgo);
  d.setHours(0, 0, 0, 0);
  return d;
};

// Spread a day's events realistically across waking hours (7am-10pm).
function randomTimeOnDay(dayOffset: number, rand: () => number): string {
  const d = startOfDay(dayOffset);
  const hour = 7 + Math.floor(rand() * 15); // 7..21
  const min = Math.floor(rand() * 60);
  const sec = Math.floor(rand() * 60);
  d.setHours(hour, min, sec, 0);
  return d.toISOString();
}

function plus(isoBase: string, hours: number, rand: () => number): string {
  const d = new Date(isoBase);
  d.setHours(d.getHours() + hours + Math.floor(rand() * 8));
  return d.toISOString();
}

function log(...args: unknown[]) {
  // eslint-disable-next-line no-console
  console.log(`[seed] ${new Date().toISOString()} ·`, ...args);
}

// ---------------------------------------------------------------------------
// Account creation (magic-link bypass: direct admin.createUser)
// ---------------------------------------------------------------------------

async function findExistingUser(email: string): Promise<string | null> {
  // The auth.users table has its own row; public.users is created by trigger.
  const { data } = await admin
    .from("users")
    .select("id, household_id")
    .eq("email", email)
    .maybeSingle();
  return data?.id ?? null;
}

async function ensurePersona(persona: Persona): Promise<string> {
  const existing = await findExistingUser(persona.email);
  if (existing) {
    log(`  ↳ ${persona.name}: already exists (${existing})`);
    return existing;
  }

  log(`  ↳ ${persona.name}: creating auth user…`);
  const { data: created, error: createErr } = await admin.auth.admin.createUser({
    email: persona.email,
    email_confirm: true, // bypass magic-link verification entirely
    user_metadata: { name: persona.name, persona_slug: persona.slug },
  });
  if (createErr || !created.user) {
    throw new Error(`Failed to create ${persona.email}: ${createErr?.message}`);
  }

  const userId = created.user.id;

  // The handle_new_auth_user trigger created public.users + households already.
  // Update the household name to something nicer.
  const { data: userRow } = await admin
    .from("users")
    .select("household_id")
    .eq("id", userId)
    .single();
  if (userRow?.household_id) {
    await admin
      .from("households")
      .update({ name: persona.household_name })
      .eq("id", userRow.household_id);
  }
  await admin.from("users").update({ display_name: persona.name }).eq("id", userId);

  // Profile — respect preserveExistingProfile.
  if (persona.preserveExistingProfile) {
    const { data: existingProfile } = await admin
      .from("user_profiles")
      .select("user_id")
      .eq("user_id", userId)
      .maybeSingle();
    if (!existingProfile) {
      await admin.from("user_profiles").insert({
        user_id: userId,
        ...persona.profile,
        quiz_completed_at: new Date().toISOString(),
        quiz_last_step: 5,
      });
    }
  } else {
    await admin
      .from("user_profiles")
      .upsert(
        {
          user_id: userId,
          ...persona.profile,
          quiz_completed_at: new Date().toISOString(),
          quiz_last_step: 5,
        },
        { onConflict: "user_id" },
      );
  }

  // Household members.
  if (persona.household_members.length > 0 && userRow?.household_id) {
    await admin.from("household_member_profiles").delete().eq("household_id", userRow.household_id);
    await admin.from("household_member_profiles").insert(
      persona.household_members.map((m) => ({
        household_id: userRow.household_id,
        name: m.name,
        age_range: m.age_range,
        allergies: m.allergies,
      })),
    );
  }

  // Synchronous quiz summary (real Haiku call).
  try {
    const { summary } = await runQuizSummary({
      userId,
      quizAnswers: {
        ...persona.profile,
        household_members: persona.household_members,
      },
      clientPlatform: "web",
    });
    await admin
      .from("user_summaries")
      .upsert(
        { user_id: userId, summary_text: summary, generated_at: new Date().toISOString() },
        { onConflict: "user_id" },
      );
    log(`  ↳ ${persona.name}: quiz summary saved (${summary.length} chars)`);
  } catch (err) {
    log(`  ↳ ${persona.name}: quiz summary FAILED — `, err);
  }

  return userId;
}

// ---------------------------------------------------------------------------
// Behavior simulation per persona-day
// ---------------------------------------------------------------------------

async function runOneSwap(
  userId: string,
  persona: Persona,
  query: string,
  dayOffset: number,
  rand: () => number,
): Promise<void> {
  let swapId: string | null = null;
  let recipe: unknown = null;

  try {
    const result = await runSwapGenerator({
      userId,
      productId: null,
      request: query,
      clientPlatform: "web",
      skipCache: true, // always exercise Sonnet
    });
    swapId = result.swap?.id ?? null;
    recipe = "output" in result ? result.output?.recipe : null;
  } catch (err) {
    log(`    ✗ swap "${query}" failed:`, err);
    return;
  }
  if (!swapId) return;

  const swapCreatedAt = randomTimeOnDay(dayOffset, rand);

  // Backdate the swap row's created_at to the simulated day.
  await admin.from("swaps").update({ created_at: swapCreatedAt }).eq("id", swapId);

  // Log a viewed_swap event.
  await admin.from("events").insert({
    user_id: userId,
    event_type: "viewed_swap",
    target_type: "swap",
    target_id: swapId,
    metadata: { query, summary: `Searched ${query}` },
    client_platform: "web",
    created_at: swapCreatedAt,
  });

  // Dismissal? (mutually exclusive with save)
  if (rand() < persona.behavior.dismissRate) {
    await admin.from("events").insert({
      user_id: userId,
      event_type: "dismissed_swap",
      target_type: "swap",
      target_id: swapId,
      metadata: { query },
      client_platform: "web",
      created_at: plus(swapCreatedAt, 0, rand),
    });
    return;
  }

  // Save?
  let saved = false;
  if (rand() < persona.behavior.saveRate) {
    const savedAt = plus(swapCreatedAt, 0, rand);
    await admin
      .from("recipe_box_entries")
      .insert({ user_id: userId, swap_id: swapId, saved_at: savedAt });
    await admin.from("events").insert({
      user_id: userId,
      event_type: "saved_to_kitchen",
      target_type: "swap",
      target_id: swapId,
      metadata: { query, summary: `Saved ${query} swap` },
      client_platform: "web",
      created_at: savedAt,
    });
    saved = true;
  }

  // Iterate? (only on saved swaps)
  if (saved && recipe && rand() < persona.behavior.iterateRate) {
    const mod = pickRandom(persona.iterationPool, rand);
    try {
      await runRecipeIterator({
        userId,
        parentRecipe: recipe,
        modificationRequest: mod,
        clientPlatform: "web",
      });
      await admin.from("events").insert({
        user_id: userId,
        event_type: "iterated_recipe",
        target_type: "swap",
        target_id: swapId,
        metadata: { modification: mod, summary: `Asked: ${mod}` },
        client_platform: "web",
        created_at: plus(swapCreatedAt, 1, rand),
      });
    } catch (err) {
      log(`    ⚠ iterate failed for "${query}":`, err);
    }
  }

  // Made-it event (1–4 days after save)?
  if (saved && rand() < persona.behavior.madeItRate) {
    const loved = rand() < persona.behavior.madeItLovedRatio;
    const eventType = loved ? "made_it_loved" : "made_it_not_for_me";
    const madeAt = (() => {
      const d = new Date(swapCreatedAt);
      d.setDate(d.getDate() + 1 + Math.floor(rand() * 4));
      d.setHours(17 + Math.floor(rand() * 4), Math.floor(rand() * 60), 0, 0);
      // Don't exceed "now"
      return (d > NOW ? NOW : d).toISOString();
    })();
    await admin.from("events").insert({
      user_id: userId,
      event_type: eventType,
      target_type: "swap",
      target_id: swapId,
      metadata: {
        query,
        summary: loved
          ? `Made the ${query} swap — loved it`
          : `Made the ${query} swap — not for us`,
      },
      client_platform: "web",
      created_at: madeAt,
    });
  }
}

// Build a per-day swap-count schedule. If totalSwapsOverride is set, distribute
// roughly evenly with some random variance so the run looks human (not 3-3-3-3…).
function buildDaySchedule(persona: Persona, rand: () => number): number[] {
  if (persona.totalSwapsOverride) {
    const total = persona.totalSwapsOverride;
    const base = Math.floor(total / DAYS);
    const extras = total - base * DAYS;
    const schedule = Array(DAYS).fill(base);
    // Sprinkle `extras` +1 swaps onto random days.
    const indices = Array.from({ length: DAYS }, (_, i) => i);
    for (let i = indices.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [indices[i], indices[j]] = [indices[j]!, indices[i]!];
    }
    for (let i = 0; i < extras; i++) schedule[indices[i]!] += 1;
    return schedule;
  }
  return Array(DAYS).fill(persona.behavior.swapsPerDay);
}

async function simulatePersona(userId: string, persona: Persona): Promise<void> {
  // Deterministic per-persona RNG so reruns are reproducible.
  const rand = makeRng(
    persona.slug.split("").reduce((a, c) => a + c.charCodeAt(0), 0),
  );

  const schedule = buildDaySchedule(persona, rand);
  const totalSwaps = schedule.reduce((a, b) => a + b, 0);
  log(`▶ ${persona.name}: ${totalSwaps} swaps across ${DAYS} days`);

  for (let dayOffset = DAYS - 1; dayOffset >= 0; dayOffset--) {
    const n = schedule[DAYS - 1 - dayOffset] ?? 0;
    for (let i = 0; i < n; i++) {
      const query = pickRandom(persona.queryPool, rand);
      await runOneSwap(userId, persona, query, dayOffset, rand);
    }
    if (dayOffset % 5 === 0) {
      log(`  · ${persona.name}: ${DAYS - dayOffset}/${DAYS} days done`);
    }
  }
  log(`✓ ${persona.name}: simulation complete (${totalSwaps} swaps)`);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  log(`Starting seed-personas: ${PERSONAS.length} personas × ${DAYS} days`);

  // Phase 1: ensure all personas exist (sequential — only ~5 quick Haiku calls)
  log("Phase 1: creating accounts + quiz summaries…");
  const userIds: Record<string, string> = {};
  for (const p of PERSONAS) {
    const uid = await ensurePersona(p);
    userIds[p.slug] = uid;
  }

  // Phase 2: simulate 30 days in PARALLEL across personas.
  log("Phase 2: simulating 30 days of usage (all personas in parallel)…");
  await Promise.all(
    PERSONAS.map((p) => simulatePersona(userIds[p.slug]!, p)),
  );

  log("✓ Done.");
  log("Persona emails:");
  for (const p of PERSONAS) log(`  · ${p.slug}: ${p.email}`);
  log("Use /admin/personas to impersonate any of them.");
  process.exit(0);
}

main().catch((err) => {
  console.error("[seed] FAILED:", err);
  process.exit(1);
});
