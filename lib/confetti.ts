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
const EMOJIS = ["⭐", "🎉", "🌟", "🚀", "🎈"];

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
 * Run a confetti show on the given canvas. Returns a stop function.
 * variant 0: falling confetti rain
 * variant 1: center starburst
 * variant 2: emoji rain
 * variant 3: fireworks
 * milestone: long gold starburst + rain
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

  const palette = milestone ? GOLD : PALETTES[variant % PALETTES.length];
  const mode = milestone ? 99 : variant % 4;
  const particles: Particle[] = [];

  function spawnRain(count: number, emoji: boolean): void {
    for (let i = 0; i < count; i++) {
      particles.push({
        x: rand(0, w),
        y: rand(-h * 0.5, 0),
        vx: rand(-30, 30),
        vy: rand(60, 200),
        rot: rand(0, Math.PI * 2),
        vrot: rand(-6, 6),
        size: emoji ? rand(14, 30) : rand(5, 11),
        color: palette[Math.floor(rand(0, palette.length))],
        shape: emoji ? "emoji" : Math.random() < 0.5 ? "rect" : "circle",
        emoji: EMOJIS[Math.floor(rand(0, EMOJIS.length))],
        gravity: 350,
        drag: 0.35,
        life: rand(2.5, 4.5),
      });
    }
  }

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

  if (mode === 0) spawnRain(160, false);
  if (mode === 1) spawnBurst(w / 2, h * 0.4, 180, true);
  if (mode === 2) spawnRain(70, true);
  if (mode === 99) {
    spawnBurst(w / 2, h * 0.35, 220, true);
    spawnRain(120, false);
  }

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
    if ((mode === 3 || mode === 99) && elapsed < durationMs - 900 && now >= nextFirework) {
      spawnBurst(rand(w * 0.2, w * 0.8), rand(h * 0.15, h * 0.5), 70, mode === 99);
      nextFirework = now + rand(280, 600);
    }
    // rain variants keep topping up early in the show
    if ((mode === 0 || mode === 2) && elapsed < durationMs * 0.5 && particles.length < 260) {
      spawnRain(8, mode === 2);
    }

    ctx!.clearRect(0, 0, w, h);
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

    if (elapsed < durationMs || particles.length > 0) {
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
