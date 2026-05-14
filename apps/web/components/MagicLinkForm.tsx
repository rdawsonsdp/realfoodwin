"use client";

import { useState } from "react";
import { apiPost } from "@/lib/api";

export function MagicLinkForm({ next }: { next?: string }) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await apiPost("/api/auth/magic-link", { email, redirect_to: next });
      setSent(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setLoading(false);
    }
  }

  if (sent) {
    return (
      <div className="card p-8 text-center animate-fade-up">
        <div className="w-16 h-16 mx-auto rounded-pill bg-sage-soft grid place-items-center text-3xl mb-4">
          ✉
        </div>
        <h2 className="text-2xl font-bold mb-2">Check your inbox</h2>
        <p className="text-ink-soft">
          We sent a sign-in link to <strong className="text-ink">{email}</strong>. Click it from this browser.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="card p-8 space-y-4 animate-fade-up">
      <div>
        <h1 className="text-3xl font-bold tracking-tight mb-2">Welcome.</h1>
        <p className="text-ink-soft">Get a sign-in link sent to your email. No passwords.</p>
      </div>

      <div>
        <label htmlFor="email" className="block text-sm font-semibold mb-2">
          Email
        </label>
        <input
          id="email"
          type="email"
          required
          autoComplete="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="you@example.com"
          className="w-full p-3 rounded-soft bg-paper border border-ink/10 outline-none focus:border-sunrise"
        />
      </div>

      <button
        type="submit"
        disabled={loading || !email}
        className="btn-primary w-full"
      >
        {loading ? "Sending…" : "Send sign-in link"}
      </button>

      {error && <p className="text-sm text-coral">{error}</p>}

      <p className="text-xs text-ink-muted text-center pt-2">
        By continuing, you agree to use Real Food Win. We never sell, share, or monetize your data.
      </p>
    </form>
  );
}
