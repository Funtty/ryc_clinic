// Generates the PWA install icons as real PNGs (no image libraries needed):
// pure pixel drawing + zlib PNG encoder. Run: node scripts/generate-pwa-icons.mjs
import { deflateSync } from "node:zlib";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const outDir = join(root, "public", "icons");
mkdirSync(outDir, { recursive: true });

// ── brand palette (src/app/globals.css) ─────────────────────────────────────
const PINE_900 = [28, 58, 55]; // #1c3a37
const PINE_950 = [16, 40, 37]; // #102825
const GOLD_400 = [224, 178, 84]; // #e0b254
const WHITE = [255, 255, 255];

// ── signed-distance primitives (inside < 0) ────────────────────────────────
function sdRoundRect(px, py, cx, cy, hw, hh, r) {
  const qx = Math.abs(px - cx) - (hw - r);
  const qy = Math.abs(py - cy) - (hh - r);
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
}

function sdPolygon(px, py, pts) {
  let d = Infinity;
  for (let i = 0; i < pts.length; i++) {
    const a = pts[i];
    const b = pts[(i + 1) % pts.length];
    const abx = b[0] - a[0];
    const aby = b[1] - a[1];
    const apx = px - a[0];
    const apy = py - a[1];
    const t = Math.max(0, Math.min(1, (apx * abx + apy * aby) / (abx * abx + aby * aby)));
    const dx = apx - t * abx;
    const dy = apy - t * aby;
    d = Math.min(d, Math.hypot(dx, dy));
  }
  return d;
}

const aa = (d) => Math.max(0, Math.min(1, 0.5 - d));

// ── tooth artwork as union of primitives (512-space) ───────────────────────
const TOOTH = [
  { d: (x, y) => sdRoundRect(x, y, 256, 150, 62, 34, 34), color: WHITE }, // crown
  {
    d: (x, y) =>
      sdPolygon(x, y, [
        [210, 184],
        [302, 184],
        [295, 298],
        [219, 298],
      ]),
    color: WHITE, // neck
  },
  { d: (x, y) => sdRoundRect(x, y, 236, 342, 22, 42, 22), color: WHITE }, // left root
  { d: (x, y) => sdRoundRect(x, y, 276, 342, 22, 42, 22), color: WHITE }, // right root
  { d: (x, y) => sdRoundRect(x, y, 256, 416, 100, 6, 6), color: GOLD_400 }, // gold smile underline
];

function render(size, opts) {
  const { rounded } = opts;
  const s = size;
  const scale = s / 512;
  const buf = Buffer.alloc(s * s * 4); // RGBA, transparent
  const radius = rounded ? (rounded === "full" ? 0 : 115 * scale) : 0;
  const inset = rounded === "full" ? 0 : 12 * scale;
  const bgDist = (x, y) => sdRoundRect(x, y, s / 2, s / 2, s / 2 - inset, s / 2 - inset, radius);

  for (let y = 0; y < s; y++) {
    for (let x = 0; x < s; x++) {
      // background: pine gradient, rounded tile (or full-bleed for maskable)
      const t = y / s;
      const bg = [
        PINE_900[0] + (PINE_950[0] - PINE_900[0]) * t,
        PINE_900[1] + (PINE_950[1] - PINE_900[1]) * t,
        PINE_900[2] + (PINE_950[2] - PINE_900[2]) * t,
      ];
      const bgA = aa(bgDist(x + 0.5, y + 0.5));
      let r = bg[0], g = bg[1], b = bg[2], a = bgA;

      // tooth art on top
      const px = x / scale + 0.5;
      const py = y / scale + 0.5;
      if (bgA > 0 && px > 0 && py > 0 && px < 512 && py < 512) {
        const dShape = Math.min(...TOOTH.map((pr) => pr.d(px, py)));
        if (dShape < 0.5) {
          let col = WHITE;
          for (const pr of TOOTH) {
            if (pr.d(px, py) < 0.5) {
              col = pr.color;
              break;
            }
          }
          const shapeA = aa(dShape);
          // composite over background
          r = col[0] * shapeA + bg[0] * (1 - shapeA);
          g = col[1] * shapeA + bg[1] * (1 - shapeA);
          b = col[2] * shapeA + bg[2] * (1 - shapeA);
          a = bgA;
        }
      }

      const idx = (y * s + x) * 4;
      buf[idx] = Math.round(r);
      buf[idx + 1] = Math.round(g);
      buf[idx + 2] = Math.round(b);
      buf[idx + 3] = Math.round(a * 255);
    }
  }
  return encodePNG(s, s, buf);
}

// ── PNG encoder ─────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(data) {
  let c = 0xffffffff;
  for (let i = 0; i < data.length; i++) c = CRC_TABLE[(c ^ data[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(width, height, rgba) {
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(width, 0);
  ihdr.writeUInt32BE(height, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  const raw = Buffer.alloc((width * 4 + 1) * height);
  for (let y = 0; y < height; y++) {
    raw[y * (width * 4 + 1)] = 0; // filter: none
    rgba.copy(raw, y * (width * 4 + 1) + 1, y * width * 4, (y + 1) * width * 4);
  }
  return Buffer.concat([sig, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

// ── emit files ──────────────────────────────────────────────────────────────
writeFileSync(join(outDir, "icon-192.png"), render(192, { rounded: "tile", pad: 12 }));
writeFileSync(join(outDir, "icon-512.png"), render(512, { rounded: "tile", pad: 12 }));
writeFileSync(join(outDir, "icon-maskable-512.png"), render(512, { rounded: "full", pad: 0 }));
console.log("Wrote icons to", outDir);