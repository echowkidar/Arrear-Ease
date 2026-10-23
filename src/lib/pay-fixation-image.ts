// Browser-side image preparation for saved pay fixation documents.
// A pay fixation is a printed (mostly black & white) page, so it is stored
//  - in grayscale, longest side at most 1600 px (small print stays readable),
//  - as WebP (JPEG where the browser cannot encode WebP, e.g. older Safari),
//  - with a separate small thumbnail (longest side 320 px, ~5–15 KB) that lists
//    and the gallery use, so the full image is downloaded only when opened.

export interface PreparedPayFixation {
  full: Blob;
  thumb: Blob;
  width: number;
  height: number;
}

export const FULL_MAX_SIDE = 1600;
export const THUMB_MAX_SIDE = 320;
export const FULL_MAX_BYTES = 700 * 1024; // Firestore document limit is 1 MiB
export const THUMB_MAX_BYTES = 48 * 1024;

const loadImage = (blob: Blob): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("This file is not a readable image."));
    };
    img.src = url;
  });

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> =>
  new Promise((resolve) => canvas.toBlob((b) => resolve(b), type, quality));

/** Encodes as WebP when supported, otherwise JPEG. */
async function encode(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  const webp = await toBlob(canvas, "image/webp", quality);
  if (webp && webp.type === "image/webp") return webp;
  const jpeg = await toBlob(canvas, "image/jpeg", Math.min(0.92, quality + 0.1));
  if (!jpeg) throw new Error("Could not encode the image.");
  return jpeg;
}

function drawGray(img: CanvasImageSource, srcW: number, srcH: number, maxSide: number): HTMLCanvasElement {
  const scale = Math.min(1, maxSide / Math.max(srcW, srcH));
  const w = Math.max(1, Math.round(srcW * scale));
  const h = Math.max(1, Math.round(srcH * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(img, 0, 0, w, h);
  const data = ctx.getImageData(0, 0, w, h);
  const p = data.data;
  for (let i = 0; i < p.length; i += 4) {
    const y = Math.round(0.299 * p[i] + 0.587 * p[i + 1] + 0.114 * p[i + 2]);
    p[i] = p[i + 1] = p[i + 2] = y;
  }
  ctx.putImageData(data, 0, 0);
  return canvas;
}

async function encodeUnder(img: HTMLImageElement, maxSide: number, maxBytes: number, qualities: number[]) {
  let side = maxSide;
  for (let round = 0; round < 4; round++) {
    const canvas = drawGray(img, img.naturalWidth, img.naturalHeight, side);
    for (const q of qualities) {
      const blob = await encode(canvas, q);
      if (blob.size <= maxBytes) return { blob, width: canvas.width, height: canvas.height };
    }
    side = Math.round(side * 0.8);
  }
  throw new Error("The image is too large even after compression.");
}

export async function preparePayFixationImage(file: Blob): Promise<PreparedPayFixation> {
  const img = await loadImage(file);
  const full = await encodeUnder(img, FULL_MAX_SIDE, FULL_MAX_BYTES, [0.62, 0.5, 0.4]);
  const thumb = await encodeUnder(img, THUMB_MAX_SIDE, THUMB_MAX_BYTES, [0.55, 0.4]);
  return { full: full.blob, thumb: thumb.blob, width: full.width, height: full.height };
}

/** Converts any image blob to a JPEG (white background) for downloading. */
export async function toJpeg(blob: Blob, quality = 0.9): Promise<Blob> {
  if (blob.type === "image/jpeg") return blob;
  const img = await loadImage(blob);
  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(img, 0, 0);
  const out = await toBlob(canvas, "image/jpeg", quality);
  if (!out) throw new Error("Could not convert the image.");
  return out;
}

export const blobToDataUrl = (blob: Blob): Promise<string> =>
  new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error);
    r.readAsDataURL(blob);
  });

export const formatBytes = (n: number) => {
  if (!n) return "0 KB";
  if (n < 1024 * 1024) return `${Math.max(1, Math.round(n / 1024))} KB`;
  if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(n < 10 * 1024 * 1024 ? 2 : 1)} MB`;
  return `${(n / (1024 * 1024 * 1024)).toFixed(2)} GB`;
};

export const safeFileName = (s: string) =>
  s.replace(/[^\w\-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "").slice(0, 60) || "file";
