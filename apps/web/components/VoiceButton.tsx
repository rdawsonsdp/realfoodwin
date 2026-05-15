"use client";

import { useEffect, useRef, useState } from "react";

// Web Speech API — browser-native, no server cost. Works on Chrome, Edge,
// macOS / iOS Safari. Firefox doesn't ship SpeechRecognition by default.

type SR = {
  start(): void;
  stop(): void;
  abort(): void;
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string; confidence: number }>> & { length: number } }) => void) | null;
  onerror: ((ev: { error: string }) => void) | null;
  onend: (() => void) | null;
};

declare global {
  interface Window {
    SpeechRecognition?: new () => SR;
    webkitSpeechRecognition?: new () => SR;
  }
}

interface Props {
  onTranscript: (text: string, isFinal: boolean) => void;
  disabled?: boolean;
}

export function VoiceButton({ onTranscript, disabled }: Props) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const recRef = useRef<SR | null>(null);

  useEffect(() => {
    const Ctor =
      typeof window !== "undefined"
        ? (window.SpeechRecognition ?? window.webkitSpeechRecognition)
        : undefined;
    setSupported(!!Ctor);
  }, []);

  function start() {
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) return;
    const rec = new Ctor();
    rec.continuous = false;
    rec.interimResults = true;
    rec.lang = "en-US";

    rec.onresult = (ev) => {
      const last = ev.results[ev.results.length - 1];
      const transcript = last?.[0]?.transcript ?? "";
      const isFinal = (last as unknown as { isFinal?: boolean })?.isFinal ?? false;
      if (transcript) onTranscript(transcript.trim(), isFinal);
    };

    rec.onerror = () => {
      setListening(false);
    };

    rec.onend = () => {
      setListening(false);
      recRef.current = null;
    };

    recRef.current = rec;
    setListening(true);
    rec.start();
  }

  function stop() {
    recRef.current?.stop();
    setListening(false);
  }

  if (!supported) return null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={listening ? stop : start}
      aria-label={listening ? "Stop listening" : "Speak the food"}
      title={listening ? "Listening… tap to stop" : "Speak the food name"}
      className={`relative grid place-items-center w-12 h-12 rounded-pill transition-all shadow-card ${
        listening
          ? "bg-coral text-white shadow-warm"
          : "bg-white text-ink ring-1 ring-ink/10 hover:ring-sunrise/40"
      } disabled:opacity-50 disabled:cursor-not-allowed`}
    >
      {listening && (
        <span
          aria-hidden
          className="absolute inset-0 rounded-pill bg-coral/40"
          style={{ animation: "voice-pulse 1.4s ease-out infinite" }}
        />
      )}
      <svg
        viewBox="0 0 24 24"
        width="20"
        height="20"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        className="relative z-10"
      >
        <rect x="9" y="3" width="6" height="12" rx="3" />
        <path d="M5 11a7 7 0 0 0 14 0" />
        <line x1="12" y1="18" x2="12" y2="22" />
        <line x1="8" y1="22" x2="16" y2="22" />
      </svg>
      <style jsx>{`
        @keyframes voice-pulse {
          0% { transform: scale(1); opacity: 0.6; }
          100% { transform: scale(1.6); opacity: 0; }
        }
      `}</style>
    </button>
  );
}
