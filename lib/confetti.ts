// Hand-rolled canvas confetti: zero dependencies, fully offline.
// Four rotating variants plus a longer gold milestone show.

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  rot: number;
  vrot: number;
  size: number;
  color: string;
  shape: "rect" | "circle" | "star" | "emoji";
  emoji?: string;
  gravity: number;
  drag: number;
  life: number; // seconds remaining
}

const PALETTES: string[][] = [
  ["#ff5252", "#ffb300", "#40c4ff", "#69f0ae", "#e040fb", "#ffee58"],
  ["#00e5ff", "#76ff03", "#ffea00", "#ff4081", "#7c4dff", "#ff9100"],
  ["#f44336", "#2196f3", "#ffeb3b", "#4caf50", "#ff9800", "#9c27b0"],
  ["#18ffff", "#ff80ab", "#b2ff59", "#ffd740", "#8c9eff", "#ea80fc"],
];

const GOLD = ["#ffd700", "#ffec8b", "#ffb300", "#fff59d", "#ffca28", "#ffffff"];
const BLAST = ["#ff3d00", "#ff6d00", "#ffab00", "#ffd700", "#fff59d", "#ffffff"];
function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function drawStar(ctx: CanvasRenderingContext2D, size: number): void {
  ctx.beginPath();
  for (let i = 0; i < 10; i++) {
    const r = i % 2 === 0 ? size : size * 0.45;
    const a = (Math.PI / 5) * i - Math.PI / 2;
    ctx.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  ctx.closePath();
  ctx.fill();
}

/**
 * Run a celebration show on the given canvas. Returns a stop function.
 * Every completed day: fireworks (variant only rotates the color palette).
 * milestone: a huge explosion — mega-burst, shockwave rings, echo blasts.
 */
export function runConfetti(
  canvas: HTMLCanvasElement,
  variant: number,
  milestone: boolean,
  durationMs: number
): () => void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return () => {};

  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const w = canvas.clientWidth;
  const h = canvas.clientHeight;
  canvas.width = w * dpr;
  canvas.height = h * dpr;
  ctx.scale(dpr, dpr);

  // variant can be a fractional streak (bonus half-days) — floor before indexing
  const palette = milestone ? BLAST : PALETTES[Math.floor(variant) % PALETTES.length];
  // fireworks every day; the milestone gets the explosion
  const mode: 3 | 4 = milestone ? 4 : 3;
  const particles: Particle[] = [];
  // expanding shockwave rings for the explosion
  const rings: { x: number; y: number; r: number; v: number; life: number }[] = [];

  function spawnBurst(cx: number, cy: number, count: number, star: boolean): void {
    for (let i = 0; i < count; i++) {
      const a = rand(0, Math.PI * 2);
      const speed = rand(150, 550);
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 100,
        rot: rand(0, Math.PI * 2),
        vrot: rand(-8, 8),
        size: star ? rand(6, 13) : rand(4, 10),
        color: palette[Math.floor(rand(0, palette.length))],
        shape: star ? "star" : Math.random() < 0.5 ? "rect" : "circle",
        gravity: 480,
        drag: 1.6,
        life: rand(1.4, 2.6),
      });
    }
  }

  /** The milestone explosion: a mega-blast of star shrapnel + a shockwave. */
  function explode(cx: number, cy: number, scale: number): void {
    for (let i = 0; i < 260 * scale; i++) {
      const a = rand(0, Math.PI * 2);
      const speed = rand(200, 950) * scale;
      particles.push({
        x: cx,
        y: cy,
        vx: Math.cos(a) * speed,
        vy: Math.sin(a) * speed - 80,
        rot: rand(0, Math.PI * 2),
        vrot: rand(-10, 10),
        size: rand(5, 15) * scale,
        color: palette[Math.floor(rand(0, palette.length))],
        shape: Math.random() < 0.6 ? "star" : "circle",
        gravity: 430,
        drag: 1.4,
        life: rand(1.6, 3.2),
      });
    }
    rings.push({ x: cx, y: cy, r: 12, v: 1400 * scale, life: 1 });
  }

  if (mode === 3) spawnBurst(w / 2, h * 0.35, 80, false);
  if (mode === 4) explode(w / 2, h * 0.42, 1);

  let last = performance.now();
  const start = last;
  let raf = 0;
  let nextFirework = 0;
  let stopped = false;

  function frame(now: number): void {
    if (stopped) return;
    const dt = Math.min(0.05, (now - last) / 1000);
    last = now;
    const elapsed = now - start;

    // fireworks keep launching through the show
    if (mode === 3 && elapsed < durationMs - 900 && now >= nextFirework) {
      spawnBurst(rand(w * 0.2, w * 0.8), rand(h * 0.15, h * 0.5), 70, false);
      nextFirework = now + rand(280, 600);
    }
    // the explosion echoes with smaller secondary blasts
    if (mode === 4 && elapsed > 600 && elapsed < durationMs - 1600 && now >= nextFirework) {
      explode(rand(w * 0.25, w * 0.75), rand(h * 0.2, h * 0.55), rand(0.3, 0.55));
      nextFirework = now + rand(650, 1100);
    }

    ctx!.clearRect(0, 0, w, h);

    // shockwave rings + initial white flash
    for (let i = rings.length - 1; i >= 0; i--) {
      const ring = rings[i];
      ring.r += ring.v * dt;
      ring.v *= Math.max(0, 1 - 2.2 * dt);
      ring.life -= dt * 1.3;
      if (ring.life <= 0) {
        rings.splice(i, 1);
        continue;
      }
      ctx!.save();
      ctx!.globalAlpha = Math.max(0, ring.life) * 0.8;
      ctx!.strokeStyle = "#ffffff";
      ctx!.lineWidth = 12 * ring.life;
      ctx!.beginPath();
      ctx!.arc(ring.x, ring.y, ring.r, 0, Math.PI * 2);
      ctx!.stroke();
      ctx!.restore();
    }
    if (mode === 4 && elapsed < 250) {
      ctx!.save();
      ctx!.globalAlpha = 0.75 * (1 - elapsed / 250);
      ctx!.fillStyle = "#ffffff";
      ctx!.fillRect(0, 0, w, h);
      ctx!.restore();
    }
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life -= dt;
      if (p.life <= 0 || p.y > h + 40) {
        particles.splice(i, 1);
        continue;
      }
      p.vy += p.gravity * dt;
      p.vx -= p.vx * p.drag * dt;
      p.vy -= p.vy * p.drag * dt * 0.5;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.rot += p.vrot * dt;

      ctx!.save();
      ctx!.translate(p.x, p.y);
      ctx!.rotate(p.rot);
      ctx!.globalAlpha = Math.min(1, p.life);
      if (p.shape === "emoji") {
        ctx!.font = `${p.size}px sans-serif`;
        ctx!.textAlign = "center";
        ctx!.textBaseline = "middle";
        ctx!.fillText(p.emoji ?? "⭐", 0, 0);
      } else {
        ctx!.fillStyle = p.color;
        if (p.shape === "rect") {
          ctx!.fillRect(-p.size / 2, -p.size / 4, p.size, p.size / 2);
        } else if (p.shape === "circle") {
          ctx!.beginPath();
          ctx!.arc(0, 0, p.size / 2, 0, Math.PI * 2);
          ctx!.fill();
        } else {
          drawStar(ctx!, p.size);
        }
      }
      ctx!.restore();
    }

    if (elapsed < durationMs || particles.length > 0 || rings.length > 0) {
      raf = requestAnimationFrame(frame);
    } else {
      ctx!.clearRect(0, 0, w, h);
    }
  }

  raf = requestAnimationFrame(frame);
  return () => {
    stopped = true;
    cancelAnimationFrame(raf);
  };
}
