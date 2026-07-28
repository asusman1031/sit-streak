"use client";

// Hidden swirl-audition page for Sawyer: /lab
// Four exit animations, one button each. Not linked from the app; once a
// winner is picked it gets wired into FlushOverlay and this page can stay
// as the place to audition future effects.
import { useEffect, useRef, useState } from "react";
import { playFlush } from "@/lib/sound";

type Frame = { x: number; y: number; scale: number; rot: number; opacity: number };
type Variant = { key: string; label: string; caption: string; ms: number; frame: (t: number, w: number, h: number) => Frame };

const VARIANTS: Variant[] = [
  {
    key: "A",
    label: "🌀",
    caption: "Drain",
    ms: 1700,
    // tight fast circles that wind down into the center, like a real flush
    frame: (t, w) => {
      const R = Math.min(w * 0.3, 150);
      const angle = -Math.PI / 2 + Math.PI * 2 * 4 * Math.pow(t, 1.4);
      const r = R * Math.min(1, t / 0.12) * Math.pow(1 - t, 1.1);
      return {
        x: Math.cos(angle) * r,
        y: Math.sin(angle) * r,
        scale: Math.max(0.02, 1 - t * 0.95),
        rot: 720 * t,
        opacity: t > 0.9 ? (1 - t) / 0.1 : 1,
      };
    },
  },
  {
    key: "B",
    label: "🔄",
    caption: "Big laps",
    ms: 1700,
    // the current one: big accelerating orbit, collapses to center
    frame: (t, w, h) => {
      const rx = Math.min(w * 0.42, 340);
      const ry = Math.min(h * 0.3, 300);
      const angle = -Math.PI / 2 + Math.PI * 2 * 2.75 * t * t;
      const reach = Math.sin(Math.PI * t);
      const shrink = Math.max(0, (t - 0.45) / 0.55);
      return {
        x: Math.cos(angle) * rx * reach,
        y: Math.sin(angle) * ry * reach,
        scale: Math.max(0.02, 1 - shrink * shrink),
        rot: 1080 * t * t,
        opacity: 1,
      };
    },
  },
  {
    key: "C",
    label: "🚀",
    caption: "Zoom away",
    ms: 1600,
    // one quick lap, then shoots off the bottom of the screen
    frame: (t, w, h) => {
      const R = Math.min(w * 0.32, 170);
      if (t < 0.55) {
        const u = t / 0.55;
        const angle = -Math.PI / 2 + Math.PI * 2 * u * u;
        const r = R * Math.sin(Math.PI * Math.min(u, 0.9));
        return { x: Math.cos(angle) * r, y: Math.sin(angle) * r, scale: 1, rot: 360 * u, opacity: 1 };
      }
      const u = (t - 0.55) / 0.45;
      return { x: 0, y: u * u * h, scale: 1 - u * 0.3, rot: 360 + 720 * u, opacity: 1 };
    },
  },
  {
    key: "D",
    label: "📺",
    caption: "Corner",
    ms: 1400,
    // spins while shrinking away into the bottom-right corner, endcard style
    frame: (t, w, h) => {
      const u = t * t;
      return {
        x: u * w * 0.4 + Math.sin(t * Math.PI) * 40,
        y: u * h * 0.36,
        scale: Math.max(0.02, 1 - u),
        rot: 900 * t * t,
        opacity: t > 0.92 ? (1 - t) / 0.08 : 1,
      };
    },
  },
];

export default function Lab() {
  const [running, setRunning] = useState<string | null>(null);
  const poopRef = useRef<HTMLDivElement>(null);
  const raf = useRef(0);

  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  const play = (v: Variant) => {
    if (running) return;
    setRunning(v.key);
    playFlush();
    const el = poopRef.current;
    if (!el) return;
    const w = window.innerWidth;
    const h = window.innerHeight;
    const start = performance.now();
    const step = (now: number) => {
      const t = Math.min(1, (now - start) / v.ms);
      const f = v.frame(t, w, h);
      el.style.transform = `translate(${f.x}px, ${f.y}px) rotate(${f.rot}deg) scale(${f.scale})`;
      el.style.opacity = String(f.opacity);
      if (t < 1) {
        raf.current = requestAnimationFrame(step);
      } else {
        setTimeout(() => {
          el.style.transform = "";
          el.style.opacity = "1";
          setRunning(null);
        }, 500);
      }
    };
    raf.current = requestAnimationFrame(step);
  };

  return (
    <main className="app-bg fixed inset-0 text-white">
      <div className="absolute inset-x-0 top-[10%] text-center text-2xl font-black">
        Which swirl is best?
      </div>
      <div
        ref={poopRef}
        className="absolute left-1/2 top-1/2 -ml-14 -mt-16 text-[7rem] leading-none"
      >
        💩
      </div>
      <div className="absolute inset-x-0 bottom-10 flex justify-center gap-3 px-4">
        {VARIANTS.map((v) => (
          <button
            key={v.key}
            onClick={() => play(v)}
            disabled={running !== null}
            className="flex w-20 flex-col items-center gap-1 rounded-2xl bg-white/15 py-3 text-2xl font-black active:bg-white/30 disabled:opacity-40"
          >
            <span>{v.label}</span>
            <span className="text-sm">{v.key}</span>
            <span className="text-[10px] font-semibold text-white/70">{v.caption}</span>
          </button>
        ))}
      </div>
    </main>
  );
}
