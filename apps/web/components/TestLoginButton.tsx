"use client";

import { useEffect, useState } from "react";
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
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("");
  const [customEmail, setCustomEmail] = useState("");
  const [error, setError] = useState<string | null>(null);

  function reset() {
    setStep("creds");
    // Pre-fill admin so the path is explicit — user only needs to type the
    // password and tap Continue.
    setUsername("admin");
    setPassword("");
    setCustomEmail("");
    setError(null);
  }

  function close() {
    setOpen(false);
    reset();
  }

  // Lock body scroll + Esc-to-close while the sheet is open. The modal/sheet
  // mounts inside a portal-style fixed wrapper below, so we don't need React
  // portals — just clean up on unmount.
  useEffect(() => {
    if (!open) return;
    document.body.classList.add("scroll-locked");
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") close();
    }
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.classList.remove("scroll-locked");
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

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
        className="inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 py-2 text-xs font-medium text-ink-soft hover:text-ink hover:bg-honey/40 border border-ink/10 rounded-pill transition-colors"
        title="Demo login: admin or impersonate any persona"
      >
        🧪 Test Login
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[90] bg-ink/50 backdrop-blur-sm grid place-items-center p-4 overflow-y-auto"
          onClick={close}
          role="dialog"
          aria-modal="true"
          style={{ minHeight: "100dvh" }}
        >
          <div
            className="card w-full max-w-md p-5 md:p-6 space-y-4 animate-fade-up max-h-[calc(100dvh-2rem)] overflow-y-auto my-auto"
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
                      inputMode="text"
                      value={username}
                      onChange={(e) => setUsername(e.target.value)}
                      className="mt-1 w-full px-3 py-3 text-base rounded-soft border border-ink/15 bg-paper focus:outline-none focus:border-sunrise"
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
                      className="mt-1 w-full px-3 py-3 text-base rounded-soft border border-ink/15 bg-paper focus:outline-none focus:border-sunrise"
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
                        inputMode="email"
                        autoComplete="email"
                        value={customEmail}
                        onChange={(e) => setCustomEmail(e.target.value)}
                        placeholder="user@example.com"
                        className="flex-1 min-w-0 px-3 py-3 text-base rounded-soft border border-ink/15 bg-paper focus:outline-none focus:border-sunrise"
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
