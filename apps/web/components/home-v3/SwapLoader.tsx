"use client";

// Playful loader shown over the SwapHero card while a swap is in flight —
// especially the longer photo + barcode flows where the user otherwise stares
// at a disabled composer. A spinning ring around a food emoji that cycles, and
// a status line that rotates through real-food-themed phrases.

import { useEffect, useState } from "react";

const EMOJIS = ["🥑", "🍓", "🥕", "🍅", "🥦", "🍋", "🌽", "🥬"];

const PHRASES = [
  "Sniffing out a real-food swap…",
  "Reading the label…",
  "Checking the pantry…",
  "Crunching the ingredients…",
  "Picking the freshest fit…",
  "Asking the curator…",
];

export function SwapLoader({ show }: { show: boolean }) {
  const [emojiIdx, setEmojiIdx] = useState(0);
  const [phraseIdx, setPhraseIdx] = useState(0);

  useEffect(() => {
    if (!show) return;
    const e = setInterval(() => setEmojiIdx((i) => (i + 1) % EMOJIS.length), 500);
    const p = setInterval(() => setPhraseIdx((i) => (i + 1) % PHRASES.length), 1800);
    return () => {
      clearInterval(e);
      clearInterval(p);
    };
  }, [show]);

  if (!show) return null;

  return (
    <div
      className="absolute inset-0 z-10 flex flex-col items-center justify-center bg-paper/85 backdrop-blur-[2px] rounded-[2rem] animate-fade-up"
      role="status"
      aria-live="polite"
      aria-label="Finding a real-food swap"
    >
      <div className="relative w-24 h-24">
        <span
          className="absolute inset-0 rounded-full border-4 border-forest-700/20 border-t-forest-700 animate-spin"
          aria-hidden
        />
        <span
          className="absolute inset-0 flex items-center justify-center text-4xl"
          aria-hidden
        >
          {EMOJIS[emojiIdx]}
        </span>
      </div>
      <p className="mt-5 text-sm md:text-base font-semibold text-ink/80 text-center max-w-[22ch] px-3">
        {PHRASES[phraseIdx]}
      </p>
    </div>
  );
}
