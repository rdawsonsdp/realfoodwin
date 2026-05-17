"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { apiPost } from "@/lib/api";

const PERSONAS: { email: string; display: string; blurb: string }[] = [
  { email: "sarah.parker+rfw-demo@realfoodwin.test", display: "Sarah Parker", blurb: "Mom of two, nut allergy" },
  { email: "marcus.cole+rfw-demo@realfoodwin.test", display: "Marcus Cole", blurb: "Fitness, cutting" },
  { email: "linda.hayes+rfw-demo@realfoodwin.test", display: "Linda Hayes", blurb: "Anti-inflammatory, GF" },
  { email: "tyler.fox+rfw-demo@realfoodwin.test", display: "Tyler & Emma Fox", blurb: "Vegan couple" },
  { email: "jessica.lee+rfw-demo@realfoodwin.test", display: "Jessica Lee", blurb: "Curious skeptic" },
];

type Step = "creds" | "choice" | "pick" | "working";

export function TestLoginButton() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState<Step>("creds");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("creds");
    setUsername("");
    setPassword("");
    setCustomEmail("");
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  function onCredsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (username.trim().toLowerCase() !== "admin") {
      setError("Unknown username.");
      return;
    }
    if (password !== "realfood") {
      setError("Incorrect password.");
      return;
    }
    setStep("choice");
  }

  async function loginAsAdmin() {
    setStep("working");
    setError(null);
    try {
      const data = await apiPost<{ redirect: string }>("/api/test-login", {
        mode: "admin",
        password,
      });
      close();
      router.push(data.redirect ?? "/admin");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("choice");
    }
  }

  async function impersonate(email: string) {
    setStep("working");
    setError(null);
    try {
      const data = await apiPost<{ redirect: string }>("/api/test-login", {
        mode: "impersonate",
        password,
        email,
      });
      close();
      router.push(data.redirect ?? "/");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setStep("pick");
    }
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="btn-ghost text-xs px-3 py-1.5 border border-ink/10 rounded-pill"
        title="Demo login: admin or impersonate any persona"
      >
        🧪 Test Login
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[80] bg-ink/40 backdrop-blur-sm grid place-items-center p-4"
          onClick={close}
        >
          <div
            className="card p-6 w-full max-w-md space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            {step === "creds" && (
              <>
                <header>
                  <h2 className="text-xl font-bold">Test Login</h2>
                  <p className="text-sm text-ink-soft">Admin credentials required.</p>
                </header>
                <form onSubmit={onCredsSubmit} className="space-y-3">
                  <label className="block">
                    <span className="text-sm font-semibold">Username</span>
                    <input
                      type="text"
                      autoFocus
                      autoComplete="username"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-soft border border-ink/15 bg-paper focus:outline-none focus:border-sunrise"
                      placeholder="admin"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm font-semibold">Password</span>
                    <input
                      type="password"
                      autoComplete="current-password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="mt-1 w-full px-3 py-2 rounded-soft border border-ink/15 bg-paper focus:outline-none focus:border-sunrise"
                    />
                  </label>
                  {error && <p className="text-sm text-coral">{error}</p>}
                  <div className="flex gap-2 justify-end pt-2">
                    <button type="button" onClick={close} className="btn-ghost">Cancel</button>
                    <button type="submit" className="btn-primary">Continue</button>
                  </div>
                </form>
              </>
            )}

            {step === "choice" && (
              <>
                <header>
                  <h2 className="text-xl font-bold">How do you want to enter?</h2>
                  <p className="text-sm text-ink-soft">Pick admin to manage models / personas / retention, or impersonate any persona.</p>
                </header>
                <div className="grid gap-3">
                  <button
                    onClick={loginAsAdmin}
                    className="card p-4 text-left hover:bg-cream transition-colors"
                  >
                    <div className="font-semibold">🛠 Sign in as Admin</div>
                    <div className="text-sm text-ink-muted">Full control room — models, personas, intelligence, satisfaction, activity, spend.</div>
                  </button>
                  <button
                    onClick={() => setStep("pick")}
                    className="card p-4 text-left hover:bg-cream transition-colors"
                  >
                    <div className="font-semibold">👤 Impersonate a user</div>
                    <div className="text-sm text-ink-muted">View the app as a specific persona.</div>
                  </button>
                </div>
                {error && <p className="text-sm text-coral">{error}</p>}
                <div className="flex justify-between pt-2">
                  <button onClick={() => setStep("creds")} className="btn-ghost text-sm">← Back</button>
                  <button onClick={close} className="btn-ghost text-sm">Cancel</button>
                </div>
              </>
            )}

            {step === "pick" && (
              <>
                <header>
                  <h2 className="text-xl font-bold">Impersonate which user?</h2>
                  <p className="text-sm text-ink-soft">Pick a persona or enter any email.</p>
                </header>
                <ul className="space-y-2">
                  {PERSONAS.map((p) => (
                    <li key={p.email}>
                      <button
                        onClick={() => impersonate(p.email)}
                        className="w-full text-left card p-3 hover:bg-cream transition-colors"
                      >
                        <div className="font-semibold">{p.display}</div>
                        <div className="text-xs text-ink-muted">{p.blurb} · {p.email}</div>
                      </button>
                    </li>
                  ))}
                </ul>
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (customEmail.trim()) void impersonate(customEmail.trim());
                  }}
                  className="pt-2 border-t border-ink/10"
                >
                  <label className="block">
                    <span className="text-sm font-semibold">Or any email</span>
                    <div className="mt-1 flex gap-2">
                      <input
                        type="email"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="flex-1 px-3 py-2 rounded-soft border border-ink/15 bg-paper focus:outline-none focus:border-sunrise"
                      />
                      <button
                        type="submit"
                        disabled={!customEmail.trim()}
                        className="btn-secondary disabled:opacity-50"
                      >
                        Sign in
                      </button>
                    </div>
                  </label>
                </form>
                {error && <p className="text-sm text-coral">{error}</p>}
                <div className="flex justify-between pt-2">
                  <button onClick={() => setStep("choice")} className="btn-ghost text-sm">← Back</button>
                  <button onClick={close} className="btn-ghost text-sm">Cancel</button>
                </div>
              </>
            )}

            {step === "working" && (
              <div className="py-8 text-center">
                <div className="text-2xl mb-2">🔄</div>
                <p className="text-ink-soft">Signing you in…</p>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}
