import { createClient } from "@supabase/supabase-js";
import { requireEnv } from "@/lib/env";
import { SystemRuleForm } from "@/components/SystemRuleForm";
import { SystemRuleRow } from "@/components/SystemRuleRow";

export const dynamic = "force-dynamic";

interface Rule {
  id: string;
  scope: "global" | "profile";
  rule: string;
  active: boolean;
  priority: number;
  profile_filter: Record<string, unknown> | null;
  updated_at: string;
}

export default async function SystemRulesPage() {
  const admin = createClient(
    requireEnv("NEXT_PUBLIC_SUPABASE_URL"),
    requireEnv("SUPABASE_SERVICE_ROLE_KEY"),
    { auth: { persistSession: false } },
  );

  const { data } = await admin
    .from("system_rules")
    .select("id, scope, rule, active, priority, profile_filter, updated_at")
    .order("priority", { ascending: false })
    .order("updated_at", { ascending: false });

  const rules = (data ?? []) as Rule[];

  return (
    <div className="space-y-6">
      <p className="text-paper/80 text-sm">
        Durable guardrails the agent must respect. Global rules apply to every Sonnet swap call. Profile-matched rules apply only when the user's profile satisfies the filter. Both inject as <code className="bg-cream text-ink px-1 rounded">&lt;system_rules&gt;</code> in the prompt.
      </p>

      <SystemRuleForm />

      <section>
        <h2 className="text-lg font-bold mb-3 text-paper">Active rules ({rules.filter((r) => r.active).length})</h2>
        {rules.length === 0 ? (
          <p className="text-paper/70 text-sm italic">
            No rules yet. Add one above.
          </p>
        ) : (
          <ul className="space-y-3">
            {rules.map((r) => (
              <SystemRuleRow key={r.id} rule={r} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
