// Generates placeholder PWA icons (gradient background + white star) with no
// image dependencies: raw RGBA pixels -> zlib -> minimal PNG. Rerun after
// Sawyer picks the real theme: node scripts/gen-icons.mjs
import { deflateSync } from "node:zlib";
import { writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");

function crc32(buf) {
  let table = crc32.table;
  if (!table) {
    table = crc32.table = new Int32Array(256);
    for (let n = 0; n < 256; n++) {
      let c = n;
      for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
      table[n] = c;
    }
  }
  let c = -1;
  for (let i = 0; i < buf.length; i++) c = table[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const typeBuf = Buffer.from(type, "ascii");
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePNG(size, pixels) {
  // pixels: Uint8Array RGBA, add filter byte 0 per scanline
  const raw = Buffer.alloc(size * (size * 4 + 1));
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    pixels.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 6; // RGBA
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ]);
}

// 5-point star point-in-polygon test
function starPolygon(cx, cy, rOuter, rInner) {
  const pts = [];
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? rOuter : rInner;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
  }
  return pts;
}

function inPolygon(x, y, pts) {
  let inside = false;
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    const [xi, yi] = pts[i];
    const [xj, yj] = pts[j];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

// gradient stops matching the app background
const FROM = [0x43, 0x38, 0xca];
const VIA = [0x7c, 0x3a, 0xed];
const TO = [0xdb, 0x27, 0x77];

function bgColor(t) {
  if (t < 0.55) {
    const u = t / 0.55;
    return [lerp(FROM[0], VIA[0], u), lerp(FROM[1], VIA[1], u), lerp(FROM[2], VIA[2], u)];
  }
  const u = (t - 0.55) / 0.45;
  return [lerp(VIA[0], TO[0], u), lerp(VIA[1], TO[1], u), lerp(VIA[2], TO[2], u)];
}

function renderIcon(size) {
  const px = Buffer.alloc(size * size * 4);
  const star = starPolygon(size / 2, size / 2 + size * 0.02, size * 0.32, size * 0.145);
  // 2x2 supersampling for smooth star edges
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      const t = (x + y) / (2 * size);
      const [br, bg, bb] = bgColor(t);
      let cover = 0;
      for (const [dx, dy] of [[0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]]) {
        if (inPolygon(x + dx, y + dy, star)) cover += 0.25;
      }
      const i = (y * size + x) * 4;
      px[i] = Math.round(lerp(br, 255, cover));
      px[i + 1] = Math.round(lerp(bg, 255, cover));
      px[i + 2] = Math.round(lerp(bb, 255, cover));
      px[i + 3] = 255;
    }
  }
  return encodePNG(size, px);
}

mkdirSync(join(root, "public"), { recursive: true });
for (const size of [180, 192, 512]) {
  writeFileSync(join(root, "public", `icon-${size}.png`), renderIcon(size));
  console.log(`icon-${size}.png`);
}
