"use client";

import { useRef } from "react";

interface Props {
  disabled?: boolean;
  onPicked: (image: { mediaType: "image/jpeg"; data: string; previewUrl: string }) => void;
}

// Camera/file picker that downsizes the chosen image to 1024px JPEG (q=0.82)
// before handing it to the parent. Keeps the base64 payload small enough to
// fit comfortably in a Vercel serverless function body.
export function PhotoUploadButton({ disabled, onPicked }: Props) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(file: File) {
    const compressed = await compress(file);
    onPicked(compressed);
  }

  return (
    <>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled}
        className="p-2 rounded-full hover:bg-sunrise/10 transition-colors disabled:opacity-40"
        aria-label="Upload a photo"
        title="Upload a photo"
      >
        📷
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        /* Omitting `capture` so the mobile native picker offers both
           "Take Photo" and "Photo Library" rather than forcing the camera. */
        className="hidden"
        onChange={async (e) => {
          const file = e.target.files?.[0];
          if (!file) return;
          await handleFile(file);
          // Allow re-picking the same file on a subsequent attempt.
          e.target.value = "";
        }}
      />
    </>
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
