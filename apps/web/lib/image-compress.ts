// Client-side image compression for the swap photo flow. Used by both
// SwapModal (modal entry) and home-v3 SwapHero (inline entry).
//
// Reads any image file the browser can decode (including iOS HEIC via the
// img-tag fallback), downscales to max 1024 on the long edge, and encodes
// JPEG at 0.82 quality. Returns base64 + a preview URL.

export interface PickedImage {
  mediaType: "image/jpeg";
  data: string;
  previewUrl: string;
}

export async function compressImage(file: File): Promise<PickedImage> {
  let src: ImageBitmap | HTMLImageElement;
  try {
    src = await createImageBitmap(file);
  } catch {
    src = await loadViaImg(file);
  }
  const srcW = src instanceof HTMLImageElement ? src.naturalWidth : src.width;
  const srcH = src instanceof HTMLImageElement ? src.naturalHeight : src.height;
  if (!srcW || !srcH) throw new Error("Image had no dimensions");
  const maxSide = 1024;
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.round(srcW * scale);
  const h = Math.round(srcH * scale);
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Canvas unavailable");
  ctx.drawImage(src, 0, 0, w, h);
  const blob: Blob = await new Promise((resolve, reject) =>
    canvas.toBlob(
      (b) => (b ? resolve(b) : reject(new Error("toBlob failed"))),
      "image/jpeg",
      0.82,
    ),
  );
  const data = await blobToBase64(blob);
  return {
    mediaType: "image/jpeg",
    data,
    previewUrl: URL.createObjectURL(blob),
  };
}

function loadViaImg(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Browser couldn't decode the image"));
    };
    img.src = url;
  });
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = () => {
      const result = reader.result;
      if (typeof result !== "string") {
        reject(new Error("FileReader result not a string"));
        return;
      }
      resolve(result.split(",")[1] ?? "");
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(blob);
  });
}
