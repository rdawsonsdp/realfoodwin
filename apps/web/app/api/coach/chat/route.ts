// POST /api/coach/chat
//
// Streaming conversational coach with tool-use memory.
// Body: { messages: [{role: 'user'|'assistant', content: string}, ...] }
// Response: text/event-stream
//   data: {"type":"text","delta":"..."}                 — token to append
//   data: {"type":"tool","name":"remember_about_user","subject":"peanut butter","memory_type":"dislike"}
//   data: {"type":"done","summary_updated":true}        — stream end
//   data: {"type":"error","message":"..."}              — failure signal
//
// The model has two tools:
//   * remember_about_user — agent records something it learned this turn.
//     We immediately write it to user_coach_memories and emit a `tool` SSE
//     event so the UI can show a quiet "noted" pill. Summary rebuild runs
//     after the stream ends so it doesn't block tokens.
//   * supersede_memory — agent records that an earlier memory is now wrong
//     and provides the replacement.
//
// The agent loop runs at most 3 turns (one stream + up to 2 tool follow-ups)
// to prevent runaway tool-loops on edge cases.

import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { createSupabaseServer } from "@/lib/supabase/server";
import { requireEnv, optionalEnv } from "@/lib/env";
import {
  addMemory,
  retractMemory,
  getMemorySummary,
  memoryContextBlock,
  rebuildMemorySummary,
  type MemoryType,
} from "@/lib/coach-memory";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MODEL_ID = "claude-sonnet-4-5-20250929";
const MAX_TURNS = 3; // bounded agent loop

// ----------------------------- tool schemas ---------------------------------

const TOOLS: Anthropic.Tool[] = [
  {
    name: "remember_about_user",
    description:
      "Record something specific you've learned about the user during this turn. Only call this when the user has clearly stated a preference, dislike, constraint, theme, goal, or win that would help you coach them better in the future. Do NOT use this for tentative interpretations or for things that are obvious from context.",
    input_schema: {
      type: "object",
      properties: {
        memory_type: {
          type: "string",
          enum: ["like", "dislike", "allergy", "constraint", "theme", "goal", "win"],
          description:
            "What kind of memory: like (enjoys), dislike (avoids), allergy (medical), constraint (e.g. cooking time/skill/family), theme (recurring pattern in their life), goal (what they want), win (a swap they've made and liked).",
        },
        subject: {
          type: "string",
          description:
            "The thing the memory is about, in 1-5 words, lowercase. e.g. 'peanut butter', 'weeknight cooking', 'afternoon energy slump'.",
        },
        note: {
          type: "string",
          description:
            "Optional 1-sentence elaboration capturing nuance. e.g. 'only in snacks, fine in sauces', 'her kids won't eat it'.",
        },
        confidence: {
          type: "string",
          enum: ["low", "medium", "high"],
          description:
            "How sure you are. Use 'high' only when the user said it clearly and unambiguously.",
        },
      },
      required: ["memory_type", "subject"],
    },
  },
  {
    name: "supersede_memory",
    description:
      "Call this when the user contradicts something you previously remembered (e.g. you noted they disliked something and they now say they like it). Provide the new fact; we'll mark the old one inactive.",
    input_schema: {
      type: "object",
      properties: {
        old_memory_id: {
          type: "string",
          description:
            "The id of the prior memory to supersede. Pick from the list provided in the system prompt.",
        },
        memory_type: { type: "string", enum: ["like", "dislike", "allergy", "constraint", "theme", "goal", "win"] },
        subject: { type: "string" },
        note: { type: "string" },
      },
      required: ["old_memory_id", "memory_type", "subject"],
    },
  },
];

// ----------------------------- helpers --------------------------------------

function firstNameFrom(displayName: string | null | undefined, email: string | null | undefined): string {
  if (displayName && displayName.trim()) return displayName.trim().split(/\s+/)[0]!;
  if (email) return email.split("@")[0]!;
  return "friend";
}

async function buildSystemPrompt(userId: string, firstName: string): Promise<string> {
  const supabase = createSupabaseServer();
  const [profileRes, memorySummary, recentEventsRes, activeMemRes] = await Promise.all([
    supabase
      .from("user_profiles")
      .select("top_goal")
      .eq("user_id", userId)
      .maybeSingle(),
    getMemorySummary(userId),
    supabase
      .from("events")
      .select("event_type, metadata, created_at")
      .eq("user_id", userId)
      .in("event_type", ["home_v2_made_swap", "made_it", "rated_loved", "rated_meh", "saved_swap"])
      .gte("created_at", new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString())
      .order("created_at", { ascending: false })
      .limit(20),
    supabase
      .from("user_coach_memories")
      .select("id, memory_type, subject")
      .eq("user_id", userId)
      .eq("active", true)
      .order("created_at", { ascending: false })
      .limit(40),
  ]);

  const topGoal = (profileRes.data as { top_goal?: string | null } | null)?.top_goal ?? null;

  const recent =
    (recentEventsRes.data as
      | { event_type: string; metadata: Record<string, unknown> | null; created_at: string }[]
      | null) ?? [];
  const activeMems =
    (activeMemRes.data as
      | { id: string; memory_type: string; subject: string }[]
      | null) ?? [];

  const activitySummary =
    recent.length > 0
      ? recent
          .slice(0, 10)
          .map((e) => {
            const sub =
              e.metadata && typeof e.metadata === "object"
                ? ((e.metadata as Record<string, unknown>)["replacement"] as string | undefined)
                : undefined;
            const days = Math.floor(
              (Date.now() - new Date(e.created_at).getTime()) / (24 * 60 * 60 * 1000),
            );
            return `- ${e.event_type}${sub ? ` (${sub})` : ""} — ${days}d ago`;
          })
          .join("\n")
      : "(no logged activity in the last 14 days)";

  const memoryBlock = memoryContextBlock(memorySummary);

  // List of supersede-eligible memory IDs so the model can call supersede_memory.
  const memoryIds =
    activeMems.length > 0
      ? activeMems
          .map((m) => `  ${m.id}  [${m.memory_type}] ${m.subject}`)
          .join("\n")
      : "  (none yet)";

  return `You are ${firstName}'s real-food coach. You're warm, conversational, never preachy, never clinical. You talk like a friend who happens to know a lot about food and habits — short sentences, no jargon, no lectures.

Your goal is to help ${firstName} build the habit of swapping ultra-processed food for real food. You do this by:
  1. Asking open, specific questions about how recent swaps are going.
  2. Listening for preferences, dislikes, constraints, themes, goals, wins.
  3. Calling the remember_about_user tool when you hear something worth remembering, so you can coach ${firstName} better tomorrow.
  4. Naturally acknowledging what you've remembered, in-line, without making it weird ("got it — no peanut butter then").

Be brief. Two or three short sentences per turn unless ${firstName} asks for more. Always end with something that invites a reply, but don't always make it a question — sometimes a gentle observation is more honest.

${firstName}'s top goal (from sign-up): ${topGoal ?? "unspecified"}.

${memoryBlock || "What I know about this user so far: (nothing yet — this is our first real conversation)"}

Recent activity (last 14 days):
${activitySummary}

Existing memory IDs (use these for supersede_memory.old_memory_id):
${memoryIds}

When to use remember_about_user vs. just acknowledging:
- DO call it when ${firstName} states a clear preference, dislike, allergy, constraint, theme, goal, or win that you didn't already know.
- DO NOT call it for off-hand mentions ("I had eggs today" is not "I like eggs").
- DO NOT call it for things already in the memory list above.
- One memory call per fact. If ${firstName} mentions two distinct preferences, call the tool twice.

Never repeat or summarize the memory list back at ${firstName} — they don't need to see what's in your notebook.`;
}

// ----------------------------- POST -----------------------------------------

const Schema = {
  parse(body: unknown): { messages: { role: "user" | "assistant"; content: string }[] } | null {
    if (!body || typeof body !== "object") return null;
    const messages = (body as Record<string, unknown>)["messages"];
    if (!Array.isArray(messages)) return null;
    const cleaned: { role: "user" | "assistant"; content: string }[] = [];
    for (const m of messages) {
      if (!m || typeof m !== "object") return null;
      const role = (m as Record<string, unknown>)["role"];
      const content = (m as Record<string, unknown>)["content"];
      if (role !== "user" && role !== "assistant") return null;
      if (typeof content !== "string") return null;
      cleaned.push({ role, content });
    }
    return { messages: cleaned };
  },
};

export async function POST(req: Request) {
  const body = await req.json().catch(() => null);
  const parsed = Schema.parse(body);
  if (!parsed) {
    return NextResponse.json(
      { error: { code: "validation_error" } },
      { status: 400 },
    );
  }

  const supabase = createSupabaseServer();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json(
      { error: { code: "unauthenticated" } },
      { status: 401 },
    );
  }

  const { data: userRow } = await supabase
    .from("users")
    .select("display_name")
    .eq("id", user.id)
    .maybeSingle();
  const firstName = firstNameFrom(
    (userRow as { display_name?: string | null } | null)?.display_name,
    user.email,
  );

  const system = await buildSystemPrompt(user.id, firstName);
  const userId = user.id;

  const useHelicone = !!optionalEnv("HELICONE_API_KEY");
  const client = new Anthropic({
    apiKey: requireEnv("ANTHROPIC_API_KEY"),
    baseURL: useHelicone ? "https://anthropic.helicone.ai/v1" : undefined,
    defaultHeaders: useHelicone
      ? { "Helicone-Auth": `Bearer ${optionalEnv("HELICONE_API_KEY")}` }
      : undefined,
  });

  // Build the agent loop as an SSE stream.
  const encoder = new TextEncoder();
  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (obj: Record<string, unknown>) => {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      };

      let messages: Anthropic.MessageParam[] = parsed.messages.map((m) => ({
        role: m.role,
        content: m.content,
      }));

      let memoryWritten = false;

      try {
        for (let turn = 0; turn < MAX_TURNS; turn++) {
          // Each turn: stream a model response. Collect the final content
          // blocks for tool-use handling.
          const liveStream = client.messages.stream({
            model: MODEL_ID,
            max_tokens: 800,
            temperature: 0.7,
            system,
            tools: TOOLS,
            messages,
          });

          liveStream.on("text", (delta: string) => {
            send({ type: "text", delta });
          });

          const finalMessage = await liveStream.finalMessage();

          // Handle tool_use blocks if any. If none, we're done.
          const toolUses = finalMessage.content.filter(
            (b): b is Anthropic.ToolUseBlock => b.type === "tool_use",
          );

          if (toolUses.length === 0 || finalMessage.stop_reason !== "tool_use") {
            // Plain assistant turn — stream is complete.
            break;
          }

          // Append the assistant's full turn (text + tool_use blocks) and
          // execute each tool, then append tool_results.
          messages = [
            ...messages,
            { role: "assistant", content: finalMessage.content },
          ];

          const toolResults: Anthropic.ToolResultBlockParam[] = [];

          for (const tu of toolUses) {
            try {
              if (tu.name === "remember_about_user") {
                const input = tu.input as {
                  memory_type: MemoryType;
                  subject: string;
                  note?: string;
                  confidence?: "low" | "medium" | "high";
                };
                await addMemory({
                  userId,
                  memoryType: input.memory_type,
                  subject: input.subject,
                  detail: input.note ? { note: input.note } : {},
                  source: "coach_chat",
                  confidence: input.confidence ?? "medium",
                });
                send({
                  type: "tool",
                  name: "remember_about_user",
                  memory_type: input.memory_type,
                  subject: input.subject,
                });
                memoryWritten = true;
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: tu.id,
                  content: "OK — recorded.",
                });
              } else if (tu.name === "supersede_memory") {
                const input = tu.input as {
                  old_memory_id: string;
                  memory_type: MemoryType;
                  subject: string;
                  note?: string;
                };
                await retractMemory(userId, input.old_memory_id);
                await addMemory({
                  userId,
                  memoryType: input.memory_type,
                  subject: input.subject,
                  detail: input.note ? { note: input.note } : {},
                  source: "coach_chat",
                  supersedesId: input.old_memory_id,
                });
                send({
                  type: "tool",
                  name: "supersede_memory",
                  subject: input.subject,
                });
                memoryWritten = true;
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: tu.id,
                  content: "OK — updated.",
                });
              } else {
                toolResults.push({
                  type: "tool_result",
                  tool_use_id: tu.id,
                  content: "Unknown tool.",
                  is_error: true,
                });
              }
            } catch (err) {
              toolResults.push({
                type: "tool_result",
                tool_use_id: tu.id,
                content: `Tool failed: ${err instanceof Error ? err.message : String(err)}`,
                is_error: true,
              });
            }
          }

          messages = [...messages, { role: "user", content: toolResults }];
        }

        // After the streaming loop completes, rebuild the synthesized memory
        // summary if anything was written. Fire-and-forget — the user's reply
        // is already streamed, so we don't block the response on this.
        if (memoryWritten) {
          rebuildMemorySummary(userId).catch((err) => {
            // eslint-disable-next-line no-console
            console.error("rebuildMemorySummary failed", err);
          });
        }

        send({ type: "done", summary_updated: memoryWritten });
      } catch (err) {
        send({
          type: "error",
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream; charset=utf-8",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
