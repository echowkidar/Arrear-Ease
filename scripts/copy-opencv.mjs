// Copies OpenCV.js from node_modules into public/vendor so the site serves it itself
// (used by the document scanner; not committed to git).
import { copyFileSync, mkdirSync, existsSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const src = join(root, "node_modules", "@techstark", "opencv-js", "dist", "opencv.js");
const dest = join(root, "public", "vendor", "opencv-4.10.0.js");

if (!existsSync(src)) {
  console.warn("[copy-opencv] @techstark/opencv-js not installed; document auto-detect will fall back to manual corners.");
  process.exit(0);
}
mkdirSync(dirname(dest), { recursive: true });
if (!existsSync(dest) || statSync(dest).size !== statSync(src).size) {
  copyFileSync(src, dest);
  console.log("[copy-opencv] copied opencv.js to public/vendor");
}
