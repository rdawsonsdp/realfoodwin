"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { apiPost, ApiError } from "@/lib/api";

type BuildMode = "dish" | "recipe" | "fridge";

interface PickedImage {
  mediaType: "image/jpeg";
  data: string;
  previewUrl: string;
}

interface Ingredient {
  name: string;
  quantity?: string;
  unit?: string;
}

interface BuildOutput {
  title: string;
  tagline?: string;
  identified_items: string[];
  assumed_pantry?: string[];
  recipe: {
    ingredients: Ingredient[];
    steps: string[];
    time_min: number;
    difficulty?: "beginner" | "comfortable" | "confident";
    meal_type?: string;
  };
  narrative: string;
}

interface BuildResponse {
  output: BuildOutput;
  latency_ms: number | null;
}

const MODE_OPTIONS: { value: BuildMode; label: string; desc: string }[] = [
  {
    value: "dish",
    label: "From a dish photo",
    desc: "Photo of finished food we'll recreate as a real-food recipe.",
  },
  {
    value: "recipe",
    label: "From a recipe photo",
    desc: "Photo of a handwritten or printed recipe.",
  },
  {
    value: "fridge",
    label: "From your fridge / pantry",
    desc: "We'll identify what you have and build a recipe.",
  },
];

const MAX_IMAGES = 6;

export function RecipeBuilder() {
  const [mode, setMode] = useState<BuildMode>("dish");
  const [images, setImages] = useState<PickedImage[]>([]);
  const [notes, setNotes] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<BuildOutput | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [badModel, setBadModel] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFiles(files: FileList | null) {
    if (!files || files.length === 0) return;
    const remaining = MAX_IMAGES - images.length;
    const toAdd = Array.from(files).slice(0, remaining);
    const compressed: PickedImage[] = [];
    for (const f of toAdd) {
      try {
        compressed.push(await compress(f));
      } catch (e) {
        // Skip files we can't decode (HEIC on older browsers, corrupted, etc).
        console.warn("Could not process image", e);
      }
    }
    if (compressed.length) setImages((prev) => [...prev, ...compressed]);
  }

  function removeImage(idx: number) {
    setImages((prev) => {
      const next = [...prev];
      const [removed] = next.splice(idx, 1);
      if (removed) URL.revokeObjectURL(removed.previewUrl);
      return next;
    });
  }

  function clearAllImages() {
    for (const img of images) URL.revokeObjectURL(img.previewUrl);
    setImages([]);
  }

  function resetAll() {
    clearAllImages();
    setNotes("");
    setResult(null);
    setError(null);
    setErrorCode(null);
    setBadModel(null);
  }

  function startOver() {
    clearAllImages();
    setNotes("");
    setError(null);
    setErrorCode(null);
    setBadModel(null);
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (images.length === 0 || loading) return;
    setLoading(true);
    setError(null);
    setErrorCode(null);
    setBadModel(null);
    setResult(null);
    try {
      const data = await apiPost<BuildResponse>("/api/recipes/build", {
        mode,
        images: images.map((i) => ({ media_type: i.mediaType, data: i.data })),
        notes: notes.trim() || undefined,
      });
      setResult(data.output);
    } catch (err) {
      if (err instanceof ApiError) {
        setError(err.message);
        setErrorCode(err.code);
        if (err.code === "model_not_found") {
          const m =
            typeof err.details === "object" && err.details && "model" in err.details
              ? String((err.details as { model: unknown }).model)
              : null;
          setBadModel(m);
        }
      } else {
        setError(err instanceof Error ? err.message : String(err));
      }
    } finally {
      setLoading(false);
    }
  }

  if (result) {
    const meta = [
      result.recipe.time_min ? `${result.recipe.time_min} min` : null,
      result.recipe.difficulty,
      result.recipe.meal_type,
    ]
      .filter(Boolean)
      .join(" · ");

    return (
      <div className="space-y-6">
        <article className="card overflow-hidden">
          <header className="p-8 md:p-10 bg-gradient-to-br from-honey/30 via-cream to-paper">
            <p className="text-xs uppercase tracking-[0.2em] text-ink-muted">
              {result.recipe.meal_type ?? "Built recipe"}
            </p>
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight leading-tight mt-2 text-ink">
              {result.title}
            </h2>
            {result.tagline && (
              <p className="text-ink-soft mt-3 text-lg">{result.tagline}</p>
            )}
            {meta && <p className="text-ink-muted mt-2 text-sm">{meta}</p>}
          </header>

          <div className="px-8 md:px-10 py-5 border-t border-ink/5 bg-paper/40 space-y-4">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sunrise-700 mb-2">
                Identified from your photos
              </p>
              <div className="flex flex-wrap gap-2">
                {result.identified_items.length === 0 ? (
                  <span className="text-sm text-ink-muted">Nothing identified.</span>
                ) : (
                  result.identified_items.map((item, i) => (
                    <span key={i} className="chip">
                      {item}
                    </span>
                  ))
                )}
              </div>
            </div>

            {result.assumed_pantry && result.assumed_pantry.length > 0 && (
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sunrise-700 mb-2">
                  Assumed pantry items
                </p>
                <div className="flex flex-wrap gap-2">
                  {result.assumed_pantry.map((item, i) => (
                    <span key={i} className="chip">
                      {item}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="p-8 md:p-10 grid md:grid-cols-[1fr_2fr] gap-10">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-sunrise-700 mb-4">
                Ingredients
              </h3>
              <ul className="space-y-2.5">
                {result.recipe.ingredients.map((ing, i) => (
                  <li key={i} className="flex gap-3 text-ink-soft leading-relaxed">
                    <span
                      className="inline-block w-1.5 h-1.5 rounded-pill bg-sunrise mt-2 flex-shrink-0"
                      aria-hidden
                    />
                    <span>
                      {ing.quantity && (
                        <strong className="text-ink mr-1">
                          {ing.quantity}
                          {ing.unit ? ` ${ing.unit}` : ""}
                        </strong>
                      )}
                      {ing.name}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section>
              <h3 className="text-xs font-semibold uppercase tracking-[0.15em] text-sunrise-700 mb-4">
                Method
              </h3>
              <ol className="space-y-5">
                {result.recipe.steps.map((s, i) => (
                  <li key={i} className="flex gap-4">
                    <span className="flex-shrink-0 w-8 h-8 rounded-pill bg-sunrise text-white font-bold text-sm grid place-items-center">
                      {i + 1}
                    </span>
                    <p className="text-ink-soft leading-relaxed pt-1.5">{s}</p>
                  </li>
                ))}
              </ol>
            </section>
          </div>

          {result.narrative && (
            <div className="px-8 md:px-10 pb-8 md:pb-10">
              <p className="text-ink-soft italic leading-relaxed border-l-2 border-coral/40 pl-4">
                {result.narrative}
              </p>
            </div>
          )}
        </article>

        <div className="flex flex-wrap gap-3">
          <button onClick={resetAll} className="btn-primary">
            Build another
          </button>
          <button onClick={startOver} className="btn-ghost-on-dark">
            ↻ Start over
          </button>
        </div>
      </div>
    );
  }

  const canAddMore = images.length < MAX_IMAGES;
  const disabled = images.length === 0 || loading;

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="card p-6 space-y-4">
        <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sunrise-700">
          What kind of photo?
        </p>
        <div className="grid gap-3 md:grid-cols-3">
          {MODE_OPTIONS.map((opt) => {
            const active = mode === opt.value;
            return (
              <label
                key={opt.value}
                className={`cursor-pointer rounded-soft p-4 ring-1 transition-colors ${
                  active
                    ? "bg-coral/10 ring-coral/40"
                    : "bg-paper ring-ink/10 hover:bg-honey/30"
                }`}
              >
                <input
                  type="radio"
                  name="mode"
                  value={opt.value}
                  checked={active}
                  onChange={() => setMode(opt.value)}
                  className="sr-only"
                  disabled={loading}
                />
                <div className="font-semibold text-ink">{opt.label}</div>
                <div className="text-sm text-ink-soft mt-1">{opt.desc}</div>
              </label>
            );
          })}
        </div>
      </div>

      <div className="card p-6 space-y-4">
        <div className="flex items-center justify-between">
          <p className="text-xs font-semibold uppercase tracking-[0.15em] text-sunrise-700">
            Photos {images.length > 0 && `(${images.length}/${MAX_IMAGES})`}
          </p>
          {images.length > 0 && (
            <button
              type="button"
              onClick={clearAllImages}
              className="btn-ghost text-sm"
              disabled={loading}
            >
              Clear all
            </button>
          )}
        </div>

        <div className="grid grid-cols-3 md:grid-cols-4 gap-3">
          {images.map((img, i) => (
            <div
              key={i}
              className="relative aspect-square rounded-soft overflow-hidden ring-1 ring-ink/10 bg-paper"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={img.previewUrl}
                alt={`Attached photo ${i + 1}`}
                className="w-full h-full object-cover"
              />
              <button
                type="button"
                onClick={() => removeImage(i)}
                disabled={loading}
                aria-label={`Remove photo ${i + 1}`}
                className="absolute top-1 right-1 w-6 h-6 grid place-items-center rounded-pill bg-ink/70 text-paper text-xs hover:bg-ink transition-colors"
              >
                ✕
              </button>
            </div>
          ))}
          {canAddMore && (
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={loading}
              className="aspect-square rounded-soft ring-1 ring-dashed ring-ink/20 bg-paper/60 grid place-items-center text-ink-soft hover:bg-honey/30 hover:text-ink transition-colors disabled:opacity-40"
            >
              <div className="text-center">
                <div className="text-2xl">+</div>
                <div className="text-xs mt-0.5">Add photo</div>
              </div>
            </button>
          )}
        </div>

        {images.length === 0 && (
          <p className="text-sm text-ink-muted">
            Attach up to {MAX_IMAGES} photos. We compress them in your browser before upload.
          </p>
        )}

        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={async (e) => {
            await handleFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      <div className="card p-6 space-y-3">
        <label
          htmlFor="rb-notes"
          className="text-xs font-semibold uppercase tracking-[0.15em] text-sunrise-700"
        >
          Notes (optional)
        </label>
        <textarea
          id="rb-notes"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          disabled={loading}
          maxLength={500}
          rows={3}
          placeholder="Any constraints? (allergies, time, cuisine, must-include)"
          className="w-full rounded-soft bg-paper px-4 py-3 text-ink placeholder:text-ink-muted ring-1 ring-ink/10 outline-none focus:ring-coral/40 transition-shadow resize-none"
        />
      </div>

      {error && errorCode === "model_not_found" ? (
        <div className="card p-4 border border-honey/50 bg-honey/20 text-ink space-y-2">
          <div>
            <strong>Configured AI model is unavailable.</strong>{" "}
            {badModel && (
              <>
                The model <code className="bg-cream px-1.5 py-0.5 rounded">{badModel}</code> was not found at Anthropic.
              </>
            )}
          </div>
          <div className="text-sm text-ink-soft">
            An admin needs to pick a valid model — Sonnet 4.6 (<code>claude-sonnet-4-6</code>) is a safe default.
          </div>
          <Link href="/admin/models" className="btn-primary inline-block">
            Open Admin → Models
          </Link>
        </div>
      ) : error ? (
        <div className="card p-4 border border-coral/30 bg-coral-soft/30 text-ink">
          <strong>Something went wrong:</strong> {error}
        </div>
      ) : null}

      <div className="flex items-center gap-3">
        <button type="submit" disabled={disabled} className="btn-primary">
          {loading ? "Cooking…" : "Build recipe"}
        </button>
        {images.length === 0 && (
          <span className="text-sm text-paper/70">Add at least one photo to start.</span>
        )}
      </div>
    </form>
  );
}

async function compress(file: File): Promise<{
  mediaType: "image/jpeg";
  data: string;
  previewUrl: string;
}> {
  const bitmap = await createImageBitmap(file);
  const maxSide = 1024;
  const scale = Math.min(1, maxSide / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas 2D context unavailable");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close?.();

  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.82,
    ),
  );

  const previewUrl = URL.createObjectURL(blob);
  const buf = await blob.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
  const data = btoa(binary);

  return { mediaType: "image/jpeg", data, previewUrl };
}
