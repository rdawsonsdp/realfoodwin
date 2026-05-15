"use client";

import { useEffect, useState } from "react";

interface Recipe {
  title: string;
  ingredients: Array<{ name: string; quantity?: string; unit?: string } | string>;
  steps: string[];
  time_min?: number | null;
  difficulty?: string | null;
  meal_type?: string | null;
}

interface Props {
  recipe: Recipe;
  shareUrl?: string;
}

function recipeAsText(r: Recipe, url?: string): string {
  const ingredients = r.ingredients
    .map((ing) => {
      if (typeof ing === "string") return `• ${ing}`;
      const q = [ing.quantity, ing.unit].filter(Boolean).join(" ");
      return `• ${q ? q + " " : ""}${ing.name}`;
    })
    .join("\n");

  const steps = r.steps.map((s, i) => `${i + 1}. ${s}`).join("\n");

  const meta = [
    r.time_min ? `${r.time_min} min` : null,
    r.difficulty,
    r.meal_type,
  ]
    .filter(Boolean)
    .join(" · ");

  return [
    `🥕 ${r.title}`,
    meta,
    "",
    "INGREDIENTS",
    ingredients,
    "",
    "STEPS",
    steps,
    "",
    url ? `Recipe: ${url}` : null,
    "— Real Food Win",
  ]
    .filter(Boolean)
    .join("\n");
}

export function RecipeActions({ recipe, shareUrl }: Props) {
  const [origin, setOrigin] = useState("");
  const [hasNativeShare, setHasNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOrigin(window.location.origin);
    setHasNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const fullUrl = shareUrl ? (shareUrl.startsWith("http") ? shareUrl : `${origin}${shareUrl}`) : origin;
  const recipeText = recipeAsText(recipe, fullUrl);

  function doPrint() {
    window.print();
  }

  async function doShare() {
    try {
      await navigator.share({
        title: `${recipe.title} — Real Food Win`,
        text: `Real-food recipe: ${recipe.title}`,
        url: fullUrl,
      });
    } catch {
      // user cancelled or share failed; no-op
    }
  }

  function doSms() {
    // sms: opens Messages on iOS/Android. The body param works on most platforms.
    const body = encodeURIComponent(recipeText);
    window.location.href = `sms:?&body=${body}`;
  }

  async function doCopy() {
    try {
      await navigator.clipboard.writeText(recipeText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // ignore
    }
  }

  const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=240x240&margin=8&color=1A1A2E&bgcolor=FFF3D6&data=${encodeURIComponent(fullUrl)}`;

  return (
    <>
      <div className="flex flex-wrap gap-2 print:hidden">
        <button onClick={doPrint} className="chip" aria-label="Print recipe">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 9 6 2 18 2 18 9" />
            <path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2" />
            <rect x="6" y="14" width="12" height="8" />
          </svg>
          Print
        </button>

        <button onClick={doSms} className="chip" aria-label="Text this recipe">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          Text it
        </button>

        {hasNativeShare && (
          <button onClick={doShare} className="chip" aria-label="Share recipe">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="18" cy="5" r="3" />
              <circle cx="6" cy="12" r="3" />
              <circle cx="18" cy="19" r="3" />
              <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
              <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
            </svg>
            Share
          </button>
        )}

        <button onClick={() => setShowQr(true)} className="chip" aria-label="Show QR code">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <path d="M14 14h3v3" />
            <path d="M21 14v7h-7" />
            <path d="M14 21v-4" />
          </svg>
          Send to phone
        </button>

        <button onClick={doCopy} className="chip" aria-label="Copy recipe text">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </svg>
          {copied ? "Copied ✓" : "Copy"}
        </button>
      </div>

      {showQr && (
        <div
          className="fixed inset-0 bg-ink/50 z-50 grid place-items-center p-6 print:hidden"
          onClick={() => setShowQr(false)}
        >
          <div
            className="card max-w-sm w-full p-8 text-center animate-fade-up"
            onClick={(e) => e.stopPropagation()}
          >
            <h3 className="text-lg font-bold mb-1">Send to your phone</h3>
            <p className="text-sm text-ink-soft mb-5">
              Scan with your phone's camera to open the recipe.
            </p>
            <div className="bg-cream p-4 rounded-soft inline-block mb-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={qrSrc} alt={`QR code for ${recipe.title}`} width={240} height={240} />
            </div>
            <p className="text-xs text-ink-muted break-all mb-4">{fullUrl}</p>
            <button onClick={() => setShowQr(false)} className="btn-secondary py-2 w-full">
              Close
            </button>
          </div>
        </div>
      )}
    </>
  );
}
