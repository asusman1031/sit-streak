"use client";

import { useEffect, useRef, useState } from "react";
import { formatCountdown } from "@/lib/time";

interface Props {
  startedAt: number;
  durationMs: number;
  bonus: boolean;
  onCancel: () => void;
}

const RING_R = 130;
const RING_C = 2 * Math.PI * RING_R;

export function TimerScreen({ startedAt, durationMs, bonus, onCancel }: Props) {
  // Local fast tick for smooth display; remaining time always derives from
  // the start timestamp, never from a pausable counter.
  const [now, setNow] = useState(() => Date.now());
  const wakeLock = useRef<WakeLockSentinel | null>(null);

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 200);
    return () => clearInterval(id);
  }, []);

  // Keep the screen awake while the timer runs; reacquire when the app
  // comes back to the foreground (the lock releases on background).
  useEffect(() => {
    let active = true;
    const acquire = async () => {
      try {
        if (active && document.visibilityState === "visible") {
          wakeLock.current = await navigator.wakeLock?.request("screen");
        }
      } catch {
        // not supported or denied; fine
      }
    };
    void acquire();
    const onVisible = () => {
      if (document.visibilityState === "visible") void acquire();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      active = false;
      document.removeEventListener("visibilitychange", onVisible);
      void wakeLock.current?.release().catch(() => {});
      wakeLock.current = null;
    };
  }, []);

  const remaining = Math.max(0, durationMs - (now - startedAt));
  const frac = remaining / durationMs;

  return (
    <main className="app-bg flex min-h-dvh flex-col items-center justify-center px-6 text-white">
      <div className="relative flex items-center justify-center">
        <svg width="300" height="300" viewBox="0 0 300 300" className="-rotate-90">
          <circle
            cx="150"
            cy="150"
            r={RING_R}
            fill="none"
            stroke="rgba(255,255,255,0.15)"
            strokeWidth="14"
          />
          <circle
            cx="150"
            cy="150"
            r={RING_R}
            fill="none"
            stroke="#fbbf24"
            strokeWidth="14"
            strokeLinecap="round"
            strokeDasharray={RING_C}
            strokeDashoffset={RING_C * (1 - frac)}
            style={{ transition: "stroke-dashoffset 0.25s linear" }}
          />
        </svg>
        <div className="absolute text-7xl font-black tabular-nums">
          {formatCountdown(remaining)}
        </div>
      </div>
      <div className="mt-6 text-lg font-semibold text-white/60">
        {bonus ? "Bonus sit! ⭐" : "You've got this!"}
      </div>
      <button
        onClick={onCancel}
        className="mt-16 rounded-full px-6 py-2 text-sm font-semibold text-white/40 transition-colors active:text-white/70"
      >
        Cancel
      </button>
    </main>
  );
}
