"use client";

import { useEffect, useState } from "react";

// Browser-native Speech Synthesis — TTS for free. Reads the swap narrative aloud.

interface Props {
  text: string;
  label?: string;
}

export function ListenButton({ text, label = "Listen" }: Props) {
  const [supported, setSupported] = useState(false);
  const [speaking, setSpeaking] = useState(false);

  useEffect(() => {
    setSupported(typeof window !== "undefined" && "speechSynthesis" in window);
  }, []);

  function speak() {
    if (!supported || !text) return;
    window.speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.rate = 1.0;
    u.pitch = 1.0;
    u.lang = "en-US";

    // Pick a warm-sounding voice if one's available.
    const voices = window.speechSynthesis.getVoices();
    const preferred =
      voices.find((v) => /samantha|karen|moira|ava|allison|joanna/i.test(v.name)) ??
      voices.find((v) => v.lang.startsWith("en"));
    if (preferred) u.voice = preferred;

    u.onend = () => setSpeaking(false);
    u.onerror = () => setSpeaking(false);
    setSpeaking(true);
    window.speechSynthesis.speak(u);
  }

  function stop() {
    window.speechSynthesis.cancel();
    setSpeaking(false);
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      onClick={speaking ? stop : speak}
      aria-label={speaking ? "Stop reading" : label}
      title={speaking ? "Stop reading" : label}
      className="inline-flex items-center gap-1.5 rounded-pill bg-white px-3 py-1.5 text-sm font-medium text-ink ring-1 ring-ink/10 shadow-card hover:ring-sunrise/40 transition-all"
    >
      <svg
        viewBox="0 0 24 24"
        width="14"
        height="14"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {speaking ? (
          <>
            <rect x="6" y="6" width="4" height="12" rx="1" />
            <rect x="14" y="6" width="4" height="12" rx="1" />
          </>
        ) : (
          <>
            <path d="M11 5L6 9H2v6h4l5 4V5z" />
            <path d="M15.54 8.46a5 5 0 0 1 0 7.07" />
            <path d="M19.07 4.93a10 10 0 0 1 0 14.14" />
          </>
        )}
      </svg>
      {speaking ? "Stop" : label}
    </button>
  );
}
