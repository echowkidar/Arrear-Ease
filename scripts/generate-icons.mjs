// Generates the PWA icons in public/icons from public/icons/logo.svg.
// Run after changing the logo: node scripts/generate-icons.mjs
import sharp from "sharp";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const dir = join(dirname(fileURLToPath(import.meta.url)), "..", "public", "icons");
const logo = readFileSync(join(dir, "logo.svg"));
const BRAND = "#2563eb";

const render = (size) => sharp(logo, { density: 384 }).resize(size, size).png();

// Opaque square behind the logo (maskable / apple-touch need no transparency).
async function padded(size, scale, file) {
  const inner = Math.round(size * scale);
  const art = await render(inner).toBuffer();
  await sharp({ create: { width: size, height: size, channels: 4, background: BRAND } })
    .composite([{ input: art, gravity: "center" }])
    .png()
    .toFile(join(dir, file));
}

await render(192).toFile(join(dir, "icon-192.png"));
await render(512).toFile(join(dir, "icon-512.png"));
await padded(512, 1, "icon-maskable-512.png"); // artwork already sits inside the central 80% safe zone
await padded(180, 1, "apple-touch-icon.png");
console.log("[generate-icons] wrote icons to public/icons");
