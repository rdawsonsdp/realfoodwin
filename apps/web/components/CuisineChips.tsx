"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { CUISINES } from "@/lib/cuisines";

// Quick "cuisine tonight" picker — 4 featured cuisines + a "more" link.
// We start with the first 4 (deterministic, matches SSR) and re-shuffle on
// mount on the client so each visit feels fresh — without a hydration mismatch.

interface Props {
  onPick: (query: string) => void;
}

export function CuisineChips({ onPick }: Props) {
  const [shown, setShown] = useState(() => CUISINES.slice(0, 4));
  useEffect(() => {
    const shuffled = [...CUISINES].sort(() => Math.random() - 0.5).slice(0, 4);
    setShown(shuffled);
  }, []);
  const router = useRouter();

  return (
    <div className="flex flex-wrap items-center gap-2 justify-center mt-2">
      <span className="text-sm text-ink-muted self-center mr-1">Or by cuisine:</span>
      {shown.map((c) => (
        <button
          key={c.value}
          type="button"
          onClick={() => onPick(`Real-food ${c.label} dinner`)}
          className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-pill ring-1 ring-ink/10 ${c.tone} text-sm font-medium hover:ring-sunrise/40`}
        >
          <span>{c.emoji}</span>
          <span>{c.label}</span>
        </button>
      ))}
      <button
        type="button"
        onClick={() => router.push("/settings")}
        className="text-sm text-ink-muted hover:text-sunrise"
      >
        Set tastes →
      </button>
    </div>
  );
}
