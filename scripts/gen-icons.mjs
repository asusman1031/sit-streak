// Regenerate PWA icons from assets/icon.svg.
// The maskable variant is the same art full-bleed (rx=0) so the OS mask
// can crop it to any shape.
import sharp from "sharp";
import { readFileSync } from "node:fs";

const svg = readFileSync("assets/icon.svg", "utf8");
const maskable = svg.replace('rx="112"', 'rx="0"');

const jobs = [
  { src: svg, size: 192, out: "public/icon-192.png" },
  { src: svg, size: 512, out: "public/icon-512.png" },
  { src: svg, size: 180, out: "public/icon-180.png" },
  { src: svg, size: 512, out: "app/icon.png" },
  { src: maskable, size: 512, out: "public/icon-512-maskable.png" },
];

for (const { src, size, out } of jobs) {
  await sharp(Buffer.from(src)).resize(size, size).png().toFile(out);
  console.log(out);
}
