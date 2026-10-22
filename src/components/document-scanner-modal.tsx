"use client";

// "Adjust Scan" step for photos of the pay-fixation proforma: finds the paper's
// edges automatically (OpenCV.js), lets the user drag the 4 corners, then
// straightens, crops and cleans the page before it is sent for AI extraction.

import React from "react";
import { Loader2, RotateCcw, RotateCw, ScanLine, Maximize, Camera, Wand2, ArrowLeft, Check } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
  canvasToFile,
  defaultQuad,
  detectDocumentQuad,
  enhanceDocument,
  fileToCanvas,
  loadOpenCv,
  rotateCanvas,
  scaledCopy,
  warpQuad,
  type Pt,
  type Quad,
} from "@/lib/doc-scan";

type Step = "loading" | "adjust" | "processing" | "preview" | "error";

interface Props {
  file: File | null;
  onClose: () => void;
  /** Called with the straightened / cleaned scan */
  onUse: (file: File) => void;
  /** Called with the original photo, unchanged */
  onSkip: (file: File) => void;
  onRetake: () => void;
}

const HANDLE_LABELS = ["Top-left", "Top-right", "Bottom-right", "Bottom-left"];

export function DocumentScannerModal({ file, onClose, onUse, onSkip, onRetake }: Props) {
  const [step, setStep] = React.useState<Step>("loading");
  const [status, setStatus] = React.useState("Reading photo…");
  const [note, setNote] = React.useState<string | null>(null);
  const [displayUrl, setDisplayUrl] = React.useState<string | null>(null);
  const [size, setSize] = React.useState<{ w: number; h: number }>({ w: 1, h: 1 });
  const [quad, setQuad] = React.useState<Quad | null>(null); // in source-canvas pixels
  const [autoQuad, setAutoQuad] = React.useState<Quad | null>(null);
  const [enhance, setEnhance] = React.useState(true);
  const [turns, setTurns] = React.useState(0);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

  const sourceRef = React.useRef<HTMLCanvasElement | null>(null);
  const cvRef = React.useRef<any>(null);
  const warpedRef = React.useRef<HTMLCanvasElement | null>(null);
  const finalRef = React.useRef<HTMLCanvasElement | null>(null);
  const boxRef = React.useRef<HTMLDivElement>(null);
  const dragIndex = React.useRef<number | null>(null);

  // 1. Load photo, OpenCV, detect corners
  React.useEffect(() => {
    if (!file) return;
    let cancelled = false;
    setStep("loading");
    setNote(null);
    setTurns(0);
    setEnhance(true);
    warpedRef.current = null;
    (async () => {
      try {
        setStatus("Reading photo…");
        const src = await fileToCanvas(file, 3000);
        if (cancelled) return;
        sourceRef.current = src;
        setSize({ w: src.width, h: src.height });
        const preview = scaledCopy(src, 1400).canvas;
        setDisplayUrl(preview.toDataURL("image/jpeg", 0.85));

        setStatus("Loading edge detection (first time only, about 10 MB)…");
        let cv: any = null;
        try {
          cv = await loadOpenCv();
        } catch (e) {
          console.warn("OpenCV unavailable:", e);
        }
        if (cancelled) return;
        cvRef.current = cv;

        let detected: Quad | null = null;
        if (cv) {
          setStatus("Finding paper edges…");
          await new Promise((r) => setTimeout(r, 30));
          const small = scaledCopy(src, 900);
          const q = detectDocumentQuad(cv, small.canvas);
          if (q) detected = q.map((p) => ({ x: p.x / small.scale, y: p.y / small.scale })) as Quad;
        }
        if (cancelled) return;
        setAutoQuad(detected);
        setQuad(detected ?? defaultQuad(src.width, src.height));
        setNote(
          detected
            ? "Paper edges found automatically. Drag the corners if needed."
            : cv
              ? "Could not find the paper edges clearly. Drag the 4 corners to the paper's corners."
              : "Auto-detect could not load. Drag the 4 corners to the paper's corners."
        );
        setStep("adjust");
      } catch (e: any) {
        if (cancelled) return;
        setStatus(e?.message || "Could not open the photo.");
        setStep("error");
      }
    })();
    return () => { cancelled = true; };
  }, [file]);

  // 2. Dragging corners (pointer events work for mouse and touch)
  const toSourcePoint = (clientX: number, clientY: number): Pt | null => {
    const box = boxRef.current?.getBoundingClientRect();
    if (!box) return null;
    const nx = Math.min(1, Math.max(0, (clientX - box.left) / box.width));
    const ny = Math.min(1, Math.max(0, (clientY - box.top) / box.height));
    return { x: nx * size.w, y: ny * size.h };
  };
  const onHandleDown = (i: number) => (e: React.PointerEvent) => {
    e.preventDefault();
    dragIndex.current = i;
    (e.target as HTMLElement).setPointerCapture?.(e.pointerId);
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (dragIndex.current === null || !quad) return;
    const p = toSourcePoint(e.clientX, e.clientY);
    if (!p) return;
    const next = [...quad] as Quad;
    next[dragIndex.current] = p;
    setQuad(next);
  };
  const onHandleUp = () => { dragIndex.current = null; };

  // 3. Straighten + clean
  const renderFinal = React.useCallback((warped: HTMLCanvasElement, doEnhance: boolean, quarterTurns: number) => {
    const cleaned = doEnhance ? enhanceDocument(warped, cvRef.current) : warped;
    const rotated = rotateCanvas(cleaned, quarterTurns);
    finalRef.current = rotated;
    setPreviewUrl(scaledCopy(rotated, 1400).canvas.toDataURL("image/jpeg", 0.85));
  }, []);

  const apply = async () => {
    if (!sourceRef.current || !quad) return;
    setStep("processing");
    await new Promise((r) => setTimeout(r, 30)); // let the spinner paint
    try {
      const warped = warpQuad(sourceRef.current, quad, cvRef.current, 2400);
      warpedRef.current = warped;
      renderFinal(warped, enhance, turns);
      setStep("preview");
    } catch (e) {
      console.error("Scan processing failed:", e);
      setNote("Could not straighten this photo. You can use the original photo instead.");
      setStep("adjust");
    }
  };

  React.useEffect(() => {
    if (step === "preview" && warpedRef.current) renderFinal(warpedRef.current, enhance, turns);
  }, [enhance, turns]); // eslint-disable-line react-hooks/exhaustive-deps

  const useScan = async () => {
    if (!finalRef.current) return;
    setStep("processing");
    try {
      const out = await canvasToFile(finalRef.current, "proforma-scan.jpg", 0.9);
      onUse(out);
    } catch {
      setStep("preview");
    }
  };

  const pointsAttr = quad ? quad.map((p) => `${(p.x / size.w) * 100},${(p.y / size.h) * 100}`).join(" ") : "";
  const aspect = size.w / size.h;

  return (
    <Dialog open={!!file} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="w-[96vw] max-w-3xl max-h-[96vh] overflow-y-auto p-3 sm:p-5 gap-3">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ScanLine className="h-5 w-5 text-primary" /> Adjust Scan
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {step === "preview"
              ? "Check the straightened page. Text should be clear and upright."
              : "Fit the blue frame to the 4 corners of the paper, then press Apply."}
          </DialogDescription>
        </DialogHeader>

        {(step === "loading" || step === "processing") && (
          <div className="flex flex-col items-center justify-center gap-3 py-16 text-sm text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-center">{step === "processing" ? "Processing…" : status}</span>
          </div>
        )}

        {step === "error" && (
          <div className="py-10 text-center space-y-4">
            <p className="text-sm text-red-600">{status}</p>
            <Button type="button" onClick={onRetake}><Camera className="h-4 w-4 mr-2" /> Retake Photo</Button>
          </div>
        )}

        {step === "adjust" && displayUrl && quad && (
          <div className="space-y-3">
            {note && <p className="text-xs text-muted-foreground">{note}</p>}
            <div className="flex justify-center">
              <div
                ref={boxRef}
                className="relative select-none touch-none bg-muted rounded-md overflow-visible"
                style={{ aspectRatio: `${size.w} / ${size.h}`, width: `min(100%, calc(60vh * ${aspect}))` }}
                onPointerMove={onHandleMove}
                onPointerUp={onHandleUp}
                onPointerCancel={onHandleUp}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={displayUrl} alt="Captured proforma" className="absolute inset-0 w-full h-full rounded-md pointer-events-none" draggable={false} />
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 w-full h-full pointer-events-none">
                  <polygon points={pointsAttr} fill="rgba(37,99,235,0.15)" stroke="rgb(37,99,235)" strokeWidth={0.6} vectorEffect="non-scaling-stroke" style={{ strokeWidth: 2 }} />
                </svg>
                {quad.map((p, i) => (
                  <button
                    key={i}
                    type="button"
                    aria-label={`${HANDLE_LABELS[i]} corner`}
                    onPointerDown={onHandleDown(i)}
                    className="absolute h-9 w-9 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-white bg-blue-600/80 shadow-lg touch-none cursor-grab active:cursor-grabbing active:scale-110 transition-transform"
                    style={{ left: `${(p.x / size.w) * 100}%`, top: `${(p.y / size.h) * 100}%` }}
                  />
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 justify-between">
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="outline" size="sm" onClick={onRetake}><Camera className="h-4 w-4 mr-1" /> Retake</Button>
                {autoQuad && (
                  <Button type="button" variant="outline" size="sm" onClick={() => setQuad(autoQuad)}><Wand2 className="h-4 w-4 mr-1" /> Auto</Button>
                )}
                <Button type="button" variant="outline" size="sm" onClick={() => setQuad(defaultQuad(size.w, size.h, 0))}><Maximize className="h-4 w-4 mr-1" /> Full Photo</Button>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => file && onSkip(file)}>Use Original</Button>
                <Button type="button" size="sm" onClick={apply}><Check className="h-4 w-4 mr-1" /> Apply</Button>
              </div>
            </div>
          </div>
        )}

        {step === "preview" && previewUrl && (
          <div className="space-y-3">
            <div className="flex justify-center">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={previewUrl} alt="Straightened scan" className="max-h-[60vh] w-auto max-w-full rounded-md border shadow-sm bg-white" />
            </div>
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex flex-wrap items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={() => setStep("adjust")}><ArrowLeft className="h-4 w-4 mr-1" /> Adjust</Button>
                <Button type="button" variant="outline" size="sm" aria-label="Rotate left" onClick={() => setTurns((t) => t - 1)}><RotateCcw className="h-4 w-4" /></Button>
                <Button type="button" variant="outline" size="sm" aria-label="Rotate right" onClick={() => setTurns((t) => t + 1)}><RotateCw className="h-4 w-4" /></Button>
                <label className="flex items-center gap-2 text-xs sm:text-sm pl-1">
                  <Switch checked={enhance} onCheckedChange={setEnhance} /> Enhance text
                </label>
              </div>
              <Button type="button" size="sm" onClick={useScan}><ScanLine className="h-4 w-4 mr-1" /> Use This Scan</Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
