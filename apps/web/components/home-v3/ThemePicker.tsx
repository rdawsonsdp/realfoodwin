"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { HOME_THEMES, CUSTOM_THEME_ID } from "@/lib/home-themes";
import { compressImage } from "@/lib/image-compress";

interface Props {
  currentThemeId: string;
  hasCustomBg: boolean;
}

// Keep the upload payload modest so the ui_prefs row stays small. The
// server also enforces a cap, but we shrink here to avoid round-tripping a
// huge image just to be rejected.
const UPLOAD_MAX_BYTES = 380 * 1024;

export function ThemePicker({ currentThemeId, hasCustomBg }: Props) {
  const router = useRouter();
  const [selected, setSelected] = useState(currentThemeId);
  const [hasCustom, setHasCustom] = useState(hasCustomBg);
  const [saving, setSaving] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  async function pick(id: string) {
    if (id === selected) return;
    setSaving(id);
    setErr(null);
    try {
      const res = await fetch("/api/profile/ui", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ theme: id }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(json?.error?.message ?? `Save failed (${res.status})`);
      }
      setSelected(id);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  async function handleUpload(file: File) {
    setSaving(CUSTOM_THEME_ID);
    setErr(null);
    try {
      const img = await compressImage(file);
      const dataUrl = `data:${img.mediaType};base64,${img.data}`;
      if (dataUrl.length > UPLOAD_MAX_BYTES) {
        throw new Error(
          "That image is too big — try a smaller one or crop it tighter.",
        );
      }
      const res = await fetch("/api/profile/ui", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          theme: CUSTOM_THEME_ID,
          custom_bg: dataUrl,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(json?.error?.message ?? `Upload failed (${res.status})`);
      }
      setHasCustom(true);
      setSelected(CUSTOM_THEME_ID);
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  async function removeCustom() {
    setSaving(CUSTOM_THEME_ID);
    setErr(null);
    try {
      const res = await fetch("/api/profile/ui", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          theme: "slate",
          custom_bg: null,
        }),
      });
      if (!res.ok) {
        const json = (await res.json().catch(() => null)) as
          | { error?: { message?: string } }
          | null;
        throw new Error(json?.error?.message ?? `Remove failed (${res.status})`);
      }
      setHasCustom(false);
      setSelected("slate");
      router.refresh();
    } catch (e) {
      setErr(e instanceof Error ? e.message : String(e));
    } finally {
      setSaving(null);
    }
  }

  const customActive = selected === CUSTOM_THEME_ID;
  const uploadBusy = saving === CUSTOM_THEME_ID;

  return (
    <div className="mt-3">
      {err && (
        <p className="text-xs text-coral mb-2" title={err}>
          {err}
        </p>
      )}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {/* Upload-your-own tile is always first so it's easy to find. */}
        <div className="relative">
          <button
            type="button"
            onClick={() => fileRef.current?.click()}
            disabled={!!saving}
            aria-pressed={customActive && hasCustom}
            title="Upload your own photo"
            className={`w-full text-left rounded-soft overflow-hidden ring-2 transition active:scale-[0.98] disabled:cursor-not-allowed ${
              customActive && hasCustom
                ? "ring-coral shadow-card"
                : "ring-ink/15 hover:ring-ink/40"
            }`}
          >
            <span
              className="block w-full h-16 flex items-center justify-center"
              style={{
                background:
                  "repeating-linear-gradient(45deg, #1B1F2C 0 8px, #2a2f40 8px 16px)",
              }}
              aria-hidden
            >
              <span className="text-2xl leading-none text-paper">📷</span>
            </span>
            <span className="block text-[11px] font-semibold py-1 px-2 bg-paper text-ink truncate">
              {uploadBusy
                ? "Uploading…"
                : hasCustom
                  ? "Your photo"
                  : "Upload photo"}
            </span>
            {customActive && hasCustom && (
              <span
                className="absolute top-1 right-1 w-5 h-5 rounded-full bg-coral text-white text-[11px] font-bold flex items-center justify-center"
                aria-hidden
              >
                ✓
              </span>
            )}
          </button>
          {hasCustom && (
            <button
              type="button"
              onClick={() => void removeCustom()}
              disabled={!!saving}
              aria-label="Remove uploaded background"
              title="Remove uploaded background"
              className="absolute -top-1 -left-1 w-5 h-5 rounded-full bg-ink text-paper text-[11px] font-bold flex items-center justify-center ring-2 ring-paper"
            >
              ×
            </button>
          )}
        </div>

        {HOME_THEMES.map((t) => {
          const isActive = t.id === selected && !(customActive && hasCustom);
          const isBusy = saving === t.id;
          return (
            <button
              key={t.id}
              type="button"
              onClick={() => void pick(t.id)}
              disabled={!!saving}
              title={`${t.name} — ${t.description}`}
              aria-label={`${t.name} — ${t.description}`}
              aria-pressed={isActive}
              className={`relative rounded-soft overflow-hidden ring-2 transition active:scale-[0.98] disabled:cursor-not-allowed ${
                isActive
                  ? "ring-coral shadow-card"
                  : "ring-ink/15 hover:ring-ink/40"
              }`}
            >
              <span
                className="block w-full h-16"
                style={{ background: t.swatch }}
                aria-hidden
              />
              <span className="block text-[11px] font-semibold py-1 px-2 bg-paper text-ink truncate">
                {isBusy ? "Saving…" : t.name}
              </span>
              {isActive && (
                <span
                  className="absolute top-1 right-1 w-5 h-5 rounded-full bg-coral text-white text-[11px] font-bold flex items-center justify-center"
                  aria-hidden
                >
                  ✓
                </span>
              )}
            </button>
          );
        })}
      </div>

      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          await handleUpload(file);
          e.target.value = "";
        }}
      />
    </div>
  );
}
