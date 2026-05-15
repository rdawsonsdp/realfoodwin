"use client";

import { useEffect, useState } from "react";

interface Props {
  recipeId: string;
  title: string;
  meta?: string;
}

// Compact share row for recipe library cards (Text / Email / Native share /
// Copy). Each handler stopPropagation so clicking an icon doesn't navigate.

export function RecipeCardActions({ recipeId, title, meta }: Props) {
  const [origin, setOrigin] = useState("");
  const [hasNativeShare, setHasNativeShare] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (typeof window === "undefined") return;
    setOrigin(window.location.origin);
    setHasNativeShare(typeof navigator !== "undefined" && !!navigator.share);
  }, []);

  const url = `${origin}/recipes/${recipeId}`;
  const shareText = `🥕 ${title}${meta ? ` (${meta})` : ""} — a real-food recipe from Real Food Win.`;

  function stop(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
  }

  function doSms(e: React.MouseEvent) {
    stop(e);
    const body = encodeURIComponent(`${shareText}\n${url}`);
    window.location.href = `sms:?&body=${body}`;
  }

  async function doShare(e: React.MouseEvent) {
    stop(e);
    try {
      await navigator.share({ title, text: shareText, url });
    } catch {
      /* user dismissed */
    }
  }

  async function doCopy(e: React.MouseEvent) {
    stop(e);
    try {
      await navigator.clipboard.writeText(`${shareText}\n${url}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      /* ignore */
    }
  }

  function doEmail(e: React.MouseEvent) {
    stop(e);
    const subject = encodeURIComponent(`${title} — Real Food Win`);
    const body = encodeURIComponent(`${shareText}\n\n${url}`);
    window.location.href = `mailto:?subject=${subject}&body=${body}`;
  }

  return (
    <div
      className="flex items-center gap-1 print:hidden"
      onClick={stop}
      role="group"
      aria-label="Share recipe"
    >
      <IconButton onClick={doSms} title="Text this recipe" label="Text">
        <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
      </IconButton>
      <IconButton onClick={doEmail} title="Email this recipe" label="Email">
        <path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z" />
        <polyline points="22,6 12,13 2,6" />
      </IconButton>
      {hasNativeShare && (
        <IconButton onClick={doShare} title="Share recipe" label="Share">
          <circle cx="18" cy="5" r="3" />
          <circle cx="6" cy="12" r="3" />
          <circle cx="18" cy="19" r="3" />
          <line x1="8.59" y1="13.51" x2="15.42" y2="17.49" />
          <line x1="15.41" y1="6.51" x2="8.59" y2="10.49" />
        </IconButton>
      )}
      <IconButton onClick={doCopy} title={copied ? "Copied" : "Copy link"} label="Copy">
        {copied ? (
          <polyline points="20 6 9 17 4 12" />
        ) : (
          <>
            <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
            <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
          </>
        )}
      </IconButton>
    </div>
  );
}

function IconButton({
  onClick,
  title,
  label,
  children,
}: {
  onClick: (e: React.MouseEvent) => void;
  title: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="p-2 rounded-pill hover:bg-honey/40 text-ink-soft hover:text-ink transition-colors"
      title={title}
      aria-label={label}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  );
}
