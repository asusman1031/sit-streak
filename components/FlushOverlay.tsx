"use client";

import { useEffect, useRef, useState } from "react";
import { playFlush } from "@/lib/sound";

interface Props {
  onDone: () => void;
}

const DANCE_MS = 1700;
const SWIRL_MS = 1700;

/**
 * Sawyer's timer-done finale: the poop dances, then flushes away with a big
 * YouTube-outro spiral — a full accelerating orbit around the screen that
 * shrinks to nothing at the center. Copy stays neutral; parents can turn the
 * whole thing off in the parent panel.
 */
export function FlushOverlay({ onDone }: Props) {
  const [phase, setPhase] = useState<"dance" | "swirl">("dance");
  const poopRef = useRef<HTMLDivElement>(null);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const t1 = setTimeout(() => {
      playFlush();
      setPhase("swirl");
    }, DANCE_MS);
    const t2 = setTimeout(() => onDoneRef.current(), DANCE_MS + SWIRL_MS + 150);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, []);

  // The outro spiral: an elliptical orbit that sweeps out from the center,
  // loops the screen with accelerating speed and spin, and collapses back
  // into the middle while shrinking away. Driven by rAF because CSS keyframes
  // can't do a real spiral path.
  useEffect(() => {
    if (phase !== "swirl") return;
    const el = poopRef.current;
    if (!el) return;
    const rx = Math.min(window.innerWidth * 0.42, 340);
    const ry = Math.min(window.innerHeight * 0.3, 300);
    const start = performance.now();
    let raf = 0;
    const frame = (now: number) => {
      const t = Math.min(1, (now - start) / SWIRL_MS);
      const angle = -Math.PI / 2 + Math.PI * 2 * 2.75 * t * t; // accelerating orbit
      const reach = Math.sin(Math.PI * t); // out, around, back to center
      const x = Math.cos(angle) * rx * reach;
      const y = Math.sin(angle) * ry * reach;
      const shrink = Math.max(0, (t - 0.45) / 0.55);
      const scale = Math.max(0.02, 1 - shrink * shrink);
      const spin = 1080 * t * t; // the emoji itself spins faster and faster
      el.style.transform = `translate(${x}px, ${y}px) rotate(${spin}deg) scale(${scale})`;
      if (t < 1) {
        raf = requestAnimationFrame(frame);
      } else {
        el.style.opacity = "0";
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [phase]);

  return (
    <div
      className="app-bg fixed inset-0 z-40"
      onClick={() => onDoneRef.current()}
    >
      <div className="pop-in absolute inset-x-0 top-[24%] text-center text-3xl font-black text-white">
        10 minutes done!
      </div>
      <div
        ref={poopRef}
        className={`absolute left-1/2 top-1/2 -ml-14 -mt-16 text-[7rem] leading-none ${
          phase === "dance" ? "poop-dance" : ""
        }`}
      >
        💩
      </div>
    </div>
  );
}
