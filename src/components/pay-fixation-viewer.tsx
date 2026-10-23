"use client";

// Full-screen viewer for saved pay fixation pages: zoom, rotate, download (JPG)
// and print (one page or all pages, each on its own A4 sheet). The full image is
// fetched only when a page is shown; the thumbnail is displayed meanwhile.

import * as React from "react";
import {
  ChevronLeft,
  ChevronRight,
  Download,
  Loader2,
  Maximize,
  Printer,
  RotateCw,
  Trash2,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { blobToDataUrl, formatBytes, safeFileName } from "@/lib/pay-fixation-image";

export interface ViewerPage {
  key: string;
  thumbUrl: string;
  bytes?: number;
  getFull: () => Promise<Blob>;
}

const loadImg = (src: string) =>
  new Promise<HTMLImageElement>((res, rej) => {
    const i = new Image();
    i.onload = () => res(i);
    i.onerror = () => rej(new Error("image"));
    i.src = src;
  });

/** Rotated copy as JPEG (white background) — used for download / print. */
async function renderJpeg(blob: Blob, rotation: number): Promise<Blob> {
  const url = URL.createObjectURL(blob);
  try {
    const img = await loadImg(url);
    const r = ((rotation % 360) + 360) % 360;
    const swap = r === 90 || r === 270;
    const c = document.createElement("canvas");
    c.width = swap ? img.naturalHeight : img.naturalWidth;
    c.height = swap ? img.naturalWidth : img.naturalHeight;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = "#fff";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.translate(c.width / 2, c.height / 2);
    ctx.rotate((r * Math.PI) / 180);
    ctx.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    return await new Promise<Blob>((res, rej) => c.toBlob((b) => (b ? res(b) : rej(new Error("encode"))), "image/jpeg", 0.92));
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function downloadBlob(blob: Blob, name: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

const escapeHtml = (s: string) => s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c]!);

/** Prints images, one per A4 page, in a hidden frame (the app page itself is untouched). */
export async function printImages(blobs: Blob[], caption: string) {
  const urls = await Promise.all(blobs.map(blobToDataUrl));
  const frame = document.createElement("iframe");
  frame.setAttribute("aria-hidden", "true");
  frame.style.cssText = "position:fixed;right:0;bottom:0;width:0;height:0;border:0;visibility:hidden";
  document.body.appendChild(frame);
  const pages = urls
    .map(
      (u, i) => `<div class="pg"><div class="cap">${escapeHtml(caption)}${urls.length > 1 ? ` — Page ${i + 1} of ${urls.length}` : ""}</div><img src="${u}" /></div>`
    )
    .join("");
  const html = `<!doctype html><html><head><meta charset="utf-8"><title>${escapeHtml(caption)}</title><style>
    @page { size: A4; margin: 8mm; }
    html,body { margin:0; padding:0; background:#fff; }
    .pg { height: 279mm; display:flex; flex-direction:column; align-items:center; page-break-after: always; break-after: page; }
    .pg:last-child { page-break-after: auto; break-after: auto; }
    .cap { font: 9pt Arial, sans-serif; color:#333; margin-bottom: 2mm; align-self: stretch; text-align:center; }
    img { max-width: 100%; max-height: 272mm; object-fit: contain; }
  </style></head><body>${pages}</body></html>`;
  const doc = frame.contentDocument!;
  doc.open();
  doc.write(html);
  doc.close();
  await Promise.all(Array.from(doc.images).map((im) => (im.complete ? Promise.resolve() : new Promise((r) => { im.onload = r; im.onerror = r; }))));
  const win = frame.contentWindow!;
  const cleanup = () => setTimeout(() => frame.remove(), 1000);
  win.addEventListener("afterprint", cleanup);
  win.focus();
  win.print();
  setTimeout(() => frame.isConnected && frame.remove(), 60000);
}

export function PayFixationViewer({
  open,
  onOpenChange,
  title,
  fileBase,
  pages,
  initialIndex = 0,
  onDelete,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  /** used for file names, e.g. "16244_ZAKIUDDIN" */
  fileBase: string;
  pages: ViewerPage[];
  initialIndex?: number;
  onDelete?: (page: ViewerPage) => void | Promise<void>;
}) {
  const [index, setIndex] = React.useState(initialIndex);
  const [zoom, setZoom] = React.useState(0); // 0 = fit
  const [rotation, setRotation] = React.useState<Record<string, number>>({});
  const [fullUrls, setFullUrls] = React.useState<Record<string, string>>({});
  const [loadingKey, setLoadingKey] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState<"" | "download" | "print" | "printAll">("");
  const [error, setError] = React.useState("");
  const urlsRef = React.useRef<Record<string, string>>({});

  React.useEffect(() => {
    if (open) {
      setIndex(Math.min(initialIndex, Math.max(0, pages.length - 1)));
      setZoom(0);
      setError("");
    }
  }, [open, initialIndex, pages.length]);

  // revoke object URLs when the viewer closes
  React.useEffect(() => {
    if (open) return;
    Object.values(urlsRef.current).forEach((u) => URL.revokeObjectURL(u));
    urlsRef.current = {};
    setFullUrls({});
  }, [open]);

  const page = pages[index];

  React.useEffect(() => {
    if (!open || !page || urlsRef.current[page.key]) return;
    let cancelled = false;
    setLoadingKey(page.key);
    setError("");
    page
      .getFull()
      .then((blob) => {
        if (cancelled) return;
        const u = URL.createObjectURL(blob);
        urlsRef.current[page.key] = u;
        setFullUrls((m) => ({ ...m, [page.key]: u }));
      })
      .catch((e) => !cancelled && setError(e?.message || "Could not load the image."))
      .finally(() => !cancelled && setLoadingKey(null));
    return () => {
      cancelled = true;
    };
  }, [open, page]);

  if (!page) return null;
  const rot = rotation[page.key] || 0;
  const src = fullUrls[page.key] || page.thumbUrl;
  const isThumbOnly = !fullUrls[page.key];
  const pageName = (i: number) => `PayFixation_${safeFileName(fileBase)}${pages.length > 1 ? `_page${i + 1}` : ""}.jpg`;

  const run = async (kind: "download" | "print" | "printAll") => {
    setBusy(kind);
    setError("");
    try {
      if (kind === "download") {
        downloadBlob(await renderJpeg(await page.getFull(), rot), pageName(index));
      } else if (kind === "print") {
        await printImages([await renderJpeg(await page.getFull(), rot)], title);
      } else {
        const blobs: Blob[] = [];
        for (const p of pages) blobs.push(await renderJpeg(await p.getFull(), rotation[p.key] || 0));
        await printImages(blobs, title);
      }
    } catch (e: any) {
      setError(e?.message || "Something went wrong.");
    }
    setBusy("");
  };

  const imgStyle: React.CSSProperties =
    zoom === 0
      ? { maxWidth: "100%", maxHeight: rot % 180 ? "none" : "100%", transform: `rotate(${rot}deg)` }
      : { width: `${zoom * 100}%`, maxWidth: "none", transform: `rotate(${rot}deg)` };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-6xl w-[96vw] h-[94vh] p-3 sm:p-4 flex flex-col gap-2">
        <DialogHeader className="space-y-0.5 pr-8">
          <DialogTitle className="text-base sm:text-lg leading-tight">{title}</DialogTitle>
          <DialogDescription className="text-xs">
            Pay fixation{pages.length > 1 ? ` — page ${index + 1} of ${pages.length}` : ""}
            {page.bytes ? ` · ${formatBytes(page.bytes)}` : ""}
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-1.5" data-testid="pf-toolbar">
          {pages.length > 1 && (
            <>
              <Button size="sm" variant="outline" disabled={index === 0} onClick={() => setIndex((i) => i - 1)} aria-label="Previous page"><ChevronLeft className="h-4 w-4" /></Button>
              <Button size="sm" variant="outline" disabled={index >= pages.length - 1} onClick={() => setIndex((i) => i + 1)} aria-label="Next page"><ChevronRight className="h-4 w-4" /></Button>
            </>
          )}
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => Math.max(0, z === 0 ? 0 : z - 0.5))} aria-label="Zoom out"><ZoomOut className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setZoom((z) => (z === 0 ? 1.5 : Math.min(4, z + 0.5)))} aria-label="Zoom in"><ZoomIn className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setZoom(0)} aria-label="Fit to screen"><Maximize className="h-4 w-4" /></Button>
          <Button size="sm" variant="outline" onClick={() => setRotation((r) => ({ ...r, [page.key]: (rot + 90) % 360 }))} aria-label="Rotate"><RotateCw className="h-4 w-4" /></Button>
          <div className="flex-1" />
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("download")} data-testid="pf-download">
            {busy === "download" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Download className="h-4 w-4 mr-1" />} Download
          </Button>
          <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("print")} data-testid="pf-print">
            {busy === "print" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />} Print{pages.length > 1 ? " page" : ""}
          </Button>
          {pages.length > 1 && (
            <Button size="sm" variant="outline" disabled={!!busy} onClick={() => run("printAll")}>
              {busy === "printAll" ? <Loader2 className="h-4 w-4 mr-1 animate-spin" /> : <Printer className="h-4 w-4 mr-1" />} Print all
            </Button>
          )}
          {onDelete && (
            <Button size="sm" variant="outline" className="text-rose-600" disabled={!!busy} onClick={() => onDelete(page)} aria-label="Delete page">
              <Trash2 className="h-4 w-4" />
            </Button>
          )}
        </div>
        {error && <div className="text-xs text-rose-600">{error}</div>}

        <div className={`relative flex-1 min-h-0 rounded-md border bg-muted/40 overflow-auto ${zoom === 0 ? "flex items-center justify-center" : ""}`} data-testid="pf-stage">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={src}
            alt={`Pay fixation page ${index + 1}`}
            style={imgStyle}
            className={`select-none bg-white shadow transition-[filter] ${zoom === 0 ? "object-contain h-full" : "block mx-auto"} ${isThumbOnly ? "blur-[1px]" : ""}`}
            draggable={false}
            data-testid="pf-image"
            data-full={isThumbOnly ? "0" : "1"}
          />
          {loadingKey === page.key && (
            <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
              <span className="rounded-full bg-background/90 px-3 py-1.5 text-xs flex items-center gap-1.5 shadow"><Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading full image…</span>
            </div>
          )}
        </div>

        {pages.length > 1 && (
          <div className="flex gap-2 overflow-x-auto pb-1">
            {pages.map((p, i) => (
              <button key={p.key} onClick={() => setIndex(i)} className={`shrink-0 rounded border-2 ${i === index ? "border-primary" : "border-transparent"}`} aria-label={`Page ${i + 1}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.thumbUrl} alt="" className="h-16 w-auto bg-white" />
              </button>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
