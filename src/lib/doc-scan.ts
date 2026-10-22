// Document scanning helpers (browser only): load OpenCV.js on demand, detect the
// paper's 4 corners, straighten (perspective-correct) and enhance the page —
// the same pipeline used by scanner apps (CamScanner / Adobe Scan / Lens).

export type Pt = { x: number; y: number };
export type Quad = [Pt, Pt, Pt, Pt]; // tl, tr, br, bl

const OPENCV_URL = "/vendor/opencv-4.10.0.js";
let cvPromise: Promise<any> | null = null;

// The Emscripten Module is "thenable" (has a .then that calls back with itself).
// Resolving a Promise with such an object makes the Promise machinery call .then
// again and again, freezing the page — so remove it once OpenCV is ready.
function untheable(cv: any) {
  if (cv && typeof cv.then === "function" && !(cv instanceof Promise)) {
    try { delete cv.then; } catch { cv.then = undefined; }
  }
  return cv;
}

/** Loads OpenCV.js once (≈10 MB, cached by the browser afterwards). */
export function loadOpenCv(timeoutMs = 60000): Promise<any> {
  if (typeof window === "undefined") return Promise.reject(new Error("No window"));
  const w = window as any;
  if (w.cv && w.cv.Mat) return Promise.resolve(untheable(w.cv));
  if (cvPromise) return cvPromise;

  cvPromise = new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      cvPromise = null;
      reject(new Error("OpenCV load timed out"));
    }, timeoutMs);
    const done = (cv: any) => { clearTimeout(timer); resolve(cv); };
    const fail = (e: any) => { clearTimeout(timer); cvPromise = null; reject(e); };

    const finish = async () => {
      try {
        let cv = w.cv;
        // Some builds export a real Promise; the Emscripten Module itself is only
        // "thenable" — awaiting it would never finish, so never await a non-Promise.
        if (cv instanceof Promise) cv = await cv;
        if (!cv) return fail(new Error("OpenCV not available"));
        if (cv.Mat) { w.cv = untheable(cv); return done(cv); }
        let settled = false;
        const ready = () => { if (settled || !cv.Mat) return; settled = true; clearInterval(poll); w.cv = untheable(cv); done(cv); };
        cv.onRuntimeInitialized = ready;
        const poll = setInterval(ready, 200); // in case initialisation finished before the hook was set
      } catch (e) { fail(e); }
    };

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${OPENCV_URL}"]`);
    if (existing) { existing.addEventListener("load", finish); existing.addEventListener("error", fail); return; }
    const s = document.createElement("script");
    s.src = OPENCV_URL;
    s.async = true;
    s.onload = finish;
    s.onerror = () => fail(new Error("Failed to load OpenCV"));
    document.body.appendChild(s);
  });
  return cvPromise;
}

/** Decodes a photo (EXIF orientation applied by the browser), capped to maxSide px. */
export async function fileToCanvas(file: File, maxSide = 3000): Promise<HTMLCanvasElement> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((res, rej) => {
      const i = new Image();
      i.onload = () => res(i);
      i.onerror = () => rej(new Error("Could not read the image"));
      i.src = url;
    });
    const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement("canvas");
    c.width = Math.round(img.naturalWidth * scale);
    c.height = Math.round(img.naturalHeight * scale);
    c.getContext("2d")!.drawImage(img, 0, 0, c.width, c.height);
    return c;
  } finally {
    URL.revokeObjectURL(url);
  }
}

export function scaledCopy(src: HTMLCanvasElement, maxSide: number): { canvas: HTMLCanvasElement; scale: number } {
  const scale = Math.min(1, maxSide / Math.max(src.width, src.height));
  const c = document.createElement("canvas");
  c.width = Math.round(src.width * scale);
  c.height = Math.round(src.height * scale);
  c.getContext("2d")!.drawImage(src, 0, 0, c.width, c.height);
  return { canvas: c, scale };
}

/** Orders 4 points as top-left, top-right, bottom-right, bottom-left. */
export function orderQuad(pts: Pt[]): Quad {
  const bySum = [...pts].sort((a, b) => a.x + a.y - (b.x + b.y));
  const byDiff = [...pts].sort((a, b) => a.y - a.x - (b.y - b.x));
  return [bySum[0], byDiff[0], bySum[3], byDiff[3]];
}

/** Default corners: a small inset from the image border. */
export function defaultQuad(w: number, h: number, inset = 0.02): Quad {
  const dx = w * inset, dy = h * inset;
  return [{ x: dx, y: dy }, { x: w - dx, y: dy }, { x: w - dx, y: h - dy }, { x: dx, y: h - dy }];
}

function quadIsUsable(q: Quad, w: number, h: number): boolean {
  // convex, reasonably large and not degenerate
  const area = Math.abs(
    q.reduce((s, p, i) => { const n = q[(i + 1) % 4]; return s + (p.x * n.y - n.x * p.y); }, 0) / 2
  );
  if (area < w * h * 0.15) return false;
  for (let i = 0; i < 4; i++) {
    const a = q[i], b = q[(i + 1) % 4], c = q[(i + 2) % 4];
    const cross = (b.x - a.x) * (c.y - b.y) - (b.y - a.y) * (c.x - b.x);
    if (cross <= 0) return false; // must turn the same way (clockwise in screen coords)
  }
  return true;
}

/**
 * Finds the paper in the photo. Returns corners in the coordinates of `canvas`,
 * or null when no clear 4-cornered page is found.
 */
export function detectDocumentQuad(cv: any, canvas: HTMLCanvasElement): Quad | null {
  const mats: any[] = [];
  const track = <T,>(m: T): T => { mats.push(m); return m; };
  try {
    const src = track(cv.imread(canvas));
    const gray = track(new cv.Mat());
    cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
    cv.GaussianBlur(gray, gray, new cv.Size(5, 5), 0);

    // automatic Canny thresholds from the median brightness
    const data: Uint8Array = gray.data;
    const hist = new Array(256).fill(0);
    for (let i = 0; i < data.length; i += 4) hist[data[i]]++;
    let acc = 0, median = 128; const half = data.length / 8;
    for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= half) { median = v; break; } }
    const lo = Math.max(10, 0.66 * median), hi = Math.min(255, 1.33 * median + 20);

    const kernel = track(cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(5, 5)));
    const w = canvas.width, h = canvas.height;

    const quadArea = (q: Quad) => Math.abs(
      q.reduce((acc, p, i) => { const n = q[(i + 1) % 4]; return acc + (p.x * n.y - n.x * p.y); }, 0) / 2
    );

    // All usable 4-cornered shapes among the biggest contours of a binary image
    const findQuads = (bin: any): Quad[] => {
      const found: Quad[] = [];
      const contours = track(new cv.MatVector());
      const hierarchy = track(new cv.Mat());
      cv.findContours(bin, contours, hierarchy, cv.RETR_EXTERNAL, cv.CHAIN_APPROX_SIMPLE);
      const list: { i: number; area: number }[] = [];
      for (let i = 0; i < contours.size(); i++) {
        const c = contours.get(i);
        list.push({ i, area: cv.contourArea(c) });
        c.delete();
      }
      list.sort((a, b) => b.area - a.area);
      for (const { i, area } of list.slice(0, 6)) {
        if (area < w * h * 0.15) break;
        const c = contours.get(i);
        const peri = cv.arcLength(c, true);
        const hull = new cv.Mat();
        cv.convexHull(c, hull, false, true);
        let got: Quad | null = null;
        for (const eps of [0.02, 0.03, 0.045, 0.06]) {
          for (const shape of [c, hull]) {
            if (got) break;
            const approx = new cv.Mat();
            cv.approxPolyDP(shape, approx, eps * peri, true);
            if (approx.rows === 4) {
              const pts: Pt[] = [];
              for (let k = 0; k < 4; k++) pts.push({ x: approx.data32S[k * 2], y: approx.data32S[k * 2 + 1] });
              const q = orderQuad(pts);
              if (quadIsUsable(q, w, h)) got = q;
            }
            approx.delete();
          }
          if (got) break;
        }
        hull.delete();
        c.delete();
        if (got) found.push(got);
      }
      return found;
    };

    // Try several edge sensitivities (faint paper edges on light tables need low
    // thresholds) plus a brightness threshold, then keep the LARGEST page-like
    // shape — the paper's outer edge rather than a table/box printed on it.
    const candidates: Quad[] = [];
    for (const [l, u] of [[lo, hi], [Math.max(8, lo * 0.5), Math.max(30, hi * 0.5)], [10, 40]]) {
      const edges = track(new cv.Mat());
      cv.Canny(gray, edges, l, u);
      cv.morphologyEx(edges, edges, cv.MORPH_CLOSE, kernel);
      cv.dilate(edges, edges, kernel);
      candidates.push(...findQuads(edges));
    }
    const th = track(new cv.Mat());
    cv.threshold(gray, th, 0, 255, cv.THRESH_BINARY + cv.THRESH_OTSU);
    cv.morphologyEx(th, th, cv.MORPH_CLOSE, kernel);
    candidates.push(...findQuads(th));

    const maxArea = w * h * 0.97; // ignore shapes that are just the photo border
    const usable = candidates.filter((q) => quadArea(q) <= maxArea);
    if (usable.length === 0) return null;

    // Paper is normally the brightest large shape: drop candidates clearly darker
    // than the brightest one (e.g. a file cover or notebook under the page).
    // Mean brightness inside the shape and outside it.
    const meanInOut = (q: Quad): { inside: number; outside: number } => {
      const mask = cv.Mat.zeros(h, w, cv.CV_8UC1);
      const poly = cv.matFromArray(4, 1, cv.CV_32SC2, q.flatMap((p) => [Math.round(p.x), Math.round(p.y)]));
      const polys = new cv.MatVector();
      polys.push_back(poly);
      cv.fillPoly(mask, polys, new cv.Scalar(255));
      const inside = cv.mean(gray, mask)[0];
      cv.bitwise_not(mask, mask);
      const outside = cv.mean(gray, mask)[0];
      mask.delete(); poly.delete(); polys.delete();
      return { inside, outside };
    };
    // A real paper edge has a darker surface (table, file) around it. A box printed
    // on the page has the same white paper outside it — reject those, so a photo
    // where the paper fills the frame keeps the whole photo instead of cutting it.
    const scored = usable
      .map((q) => ({ q, area: quadArea(q), ...meanInOut(q) }))
      .filter((c) => c.outside < c.inside - 12);
    if (scored.length === 0) return null;
    const brightest = Math.max(...scored.map((c) => c.inside));
    const quad = scored
      .filter((c) => c.inside >= brightest * 0.85)
      .sort((a, b) => b.area - a.area)[0]?.q ?? null;
    return quad;
  } catch (e) {
    console.warn("Document detection failed:", e);
    return null;
  } finally {
    for (const m of mats) { try { (m as any).delete(); } catch { /* already freed */ } }
  }
}

const dist = (a: Pt, b: Pt) => Math.hypot(a.x - b.x, a.y - b.y);

/** Output size for the straightened page, capped to maxSide on the long edge. */
export function outputSize(q: Quad, maxSide = 2400): { w: number; h: number } {
  let w = Math.max(dist(q[0], q[1]), dist(q[3], q[2]));
  let h = Math.max(dist(q[0], q[3]), dist(q[1], q[2]));
  const s = Math.min(1, maxSide / Math.max(w, h));
  return { w: Math.max(1, Math.round(w * s)), h: Math.max(1, Math.round(h * s)) };
}

/** Solves the homography that maps destination rectangle points to source points. */
export function homography(dst: Pt[], src: Pt[]): number[] {
  const A: number[][] = [];
  for (let i = 0; i < 4; i++) {
    const { x, y } = dst[i], { x: u, y: v } = src[i];
    A.push([x, y, 1, 0, 0, 0, -u * x, -u * y, u]);
    A.push([0, 0, 0, x, y, 1, -v * x, -v * y, v]);
  }
  // Gaussian elimination with partial pivoting
  for (let c = 0; c < 8; c++) {
    let p = c;
    for (let r = c + 1; r < 8; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
    [A[c], A[p]] = [A[p], A[c]];
    for (let r = 0; r < 8; r++) {
      if (r === c) continue;
      const f = A[r][c] / A[c][c];
      for (let k = c; k < 9; k++) A[r][k] -= f * A[c][k];
    }
  }
  const h = A.map((row, i) => row[8] / row[i]);
  return [...h, 1];
}

/** Straightens the page. Uses OpenCV when loaded, otherwise a pure-JS warp. */
export function warpQuad(source: HTMLCanvasElement, q: Quad, cv: any | null, maxSide = 2400): HTMLCanvasElement {
  const { w, h } = outputSize(q, maxSide);
  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;

  if (cv && cv.Mat) {
    const src = cv.imread(source);
    const dst = new cv.Mat();
    const srcPts = cv.matFromArray(4, 1, cv.CV_32FC2, [q[0].x, q[0].y, q[1].x, q[1].y, q[2].x, q[2].y, q[3].x, q[3].y]);
    const dstPts = cv.matFromArray(4, 1, cv.CV_32FC2, [0, 0, w, 0, w, h, 0, h]);
    const M = cv.getPerspectiveTransform(srcPts, dstPts);
    try {
      cv.warpPerspective(src, dst, M, new cv.Size(w, h), cv.INTER_CUBIC, cv.BORDER_REPLICATE, new cv.Scalar());
      cv.imshow(out, dst);
      return out;
    } finally {
      src.delete(); dst.delete(); srcPts.delete(); dstPts.delete(); M.delete();
    }
  }

  // Pure JS: inverse mapping with bilinear sampling
  const H = homography(
    [{ x: 0, y: 0 }, { x: w, y: 0 }, { x: w, y: h }, { x: 0, y: h }],
    q
  );
  const sctx = source.getContext("2d")!;
  const sw = source.width, sh = source.height;
  const sd = sctx.getImageData(0, 0, sw, sh).data;
  const octx = out.getContext("2d")!;
  const od = octx.createImageData(w, h);
  const o = od.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const den = H[6] * x + H[7] * y + 1;
      let u = (H[0] * x + H[1] * y + H[2]) / den;
      let v = (H[3] * x + H[4] * y + H[5]) / den;
      u = Math.min(Math.max(u, 0), sw - 1.001);
      v = Math.min(Math.max(v, 0), sh - 1.001);
      const x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0;
      const i00 = (y0 * sw + x0) * 4, i10 = i00 + 4, i01 = i00 + sw * 4, i11 = i01 + 4;
      const oi = (y * w + x) * 4;
      for (let k = 0; k < 3; k++) {
        const top = sd[i00 + k] * (1 - fx) + sd[i10 + k] * fx;
        const bot = sd[i01 + k] * (1 - fx) + sd[i11 + k] * fx;
        o[oi + k] = top * (1 - fy) + bot * fy;
      }
      o[oi + 3] = 255;
    }
  }
  octx.putImageData(od, 0, 0);
  return out;
}

/**
 * Scanner-style clean-up: removes shadows / uneven lighting and boosts contrast
 * (grayscale). Keeps stamps and handwriting readable (no hard black/white).
 */
export function enhanceDocument(page: HTMLCanvasElement, cv: any | null): HTMLCanvasElement {
  const out = document.createElement("canvas");
  out.width = page.width;
  out.height = page.height;

  if (cv && cv.Mat) {
    const src = cv.imread(page);
    const gray = new cv.Mat();
    const bg = new cv.Mat();
    const norm = new cv.Mat();
    const kernel = cv.getStructuringElement(cv.MORPH_RECT, new cv.Size(9, 9));
    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY);
      // background (paper + shadows) estimate: remove text by dilation, then smooth
      cv.dilate(gray, bg, kernel);
      const k = Math.max(21, (Math.round(Math.min(page.width, page.height) / 40) | 1));
      cv.medianBlur(bg, bg, k % 2 === 1 ? k : k + 1);
      // divide by background => flat white paper, dark text
      cv.divide(gray, bg, norm, 255);
      cv.normalize(norm, norm, 0, 255, cv.NORM_MINMAX);
      cv.imshow(out, norm);
      return out;
    } finally {
      src.delete(); gray.delete(); bg.delete(); norm.delete(); kernel.delete();
    }
  }

  // Pure JS fallback: grayscale + percentile contrast stretch
  const ctx = page.getContext("2d")!;
  const id = ctx.getImageData(0, 0, page.width, page.height);
  const d = id.data;
  const hist = new Array(256).fill(0);
  for (let i = 0; i < d.length; i += 4) {
    const g = (d[i] * 0.299 + d[i + 1] * 0.587 + d[i + 2] * 0.114) | 0;
    d[i] = g; hist[g]++;
  }
  const total = d.length / 4;
  let lo = 0, hi = 255, acc = 0;
  for (let v = 0; v < 256; v++) { acc += hist[v]; if (acc >= total * 0.02) { lo = v; break; } }
  acc = 0;
  for (let v = 255; v >= 0; v--) { acc += hist[v]; if (acc >= total * 0.05) { hi = v; break; } }
  const range = Math.max(1, hi - lo);
  for (let i = 0; i < d.length; i += 4) {
    const g = Math.min(255, Math.max(0, ((d[i] - lo) * 255) / range));
    d[i] = d[i + 1] = d[i + 2] = g;
  }
  out.getContext("2d")!.putImageData(id, 0, 0);
  return out;
}

export function rotateCanvas(c: HTMLCanvasElement, quarterTurns: number): HTMLCanvasElement {
  const t = ((quarterTurns % 4) + 4) % 4;
  if (t === 0) return c;
  const out = document.createElement("canvas");
  out.width = t % 2 ? c.height : c.width;
  out.height = t % 2 ? c.width : c.height;
  const ctx = out.getContext("2d")!;
  ctx.translate(out.width / 2, out.height / 2);
  ctx.rotate((t * Math.PI) / 2);
  ctx.drawImage(c, -c.width / 2, -c.height / 2);
  return out;
}

export function canvasToFile(c: HTMLCanvasElement, name = "scan.jpg", quality = 0.9): Promise<File> {
  return new Promise((resolve, reject) => {
    c.toBlob(
      (b) => (b ? resolve(new File([b], name, { type: "image/jpeg", lastModified: Date.now() })) : reject(new Error("Could not encode image"))),
      "image/jpeg",
      quality
    );
  });
}
