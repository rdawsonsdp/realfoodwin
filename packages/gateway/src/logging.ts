import { getServiceSupabase } from "./supabase.js";
import { PRICING, type ModelTier } from "./llm/anthropic.js";

export function calculateCost(
  tier: ModelTier,
  usage: { input_tokens: number; output_tokens: number },
): number {
  const p = PRICING[tier];
  return (
    (usage.input_tokens / 1_000_000) * p.input +
    (usage.output_tokens / 1_000_000) * p.output
  );
}

export interface AgentCallLog {
  user_id: string | null;
  agent_name: string;
  model: string;
  prompt_version: string;
  prompt_hash?: string;
  input_tokens: number;
  output_tokens: number;
  cost_usd: number;
  latency_ms: number;
  status: "success" | "error";
  client_platform: "ios" | "android" | "web";
}

export async function logAgentCall(entry: AgentCallLog): Promise<void> {
  try {
    const sb = getServiceSupabase();
    await sb.from("agent_calls").insert(entry);
  } catch (err) {
    // Logging must never fail the user-facing call.
    // eslint-disable-next-line no-console
    console.error("[gateway] failed to log agent_call:", err);
  }
}
