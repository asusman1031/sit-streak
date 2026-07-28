"use client";

import { useEffect, useRef, useState } from "react";
import { runConfetti } from "@/lib/confetti";
import { MILESTONE_EMOJI } from "@/lib/types";

interface Props {
  streak: number;
  milestone: number | null;
  onDismiss: () => void;
}

/** Day complete: the payoff. Fireworks every day; a huge explosion on
 *  10-day milestones. Streak number animates up, dismissible by tap. */
export function Celebration({ streak, milestone, onDismiss }: Props) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [shown, setShown] = useState(Math.max(0, streak - 1));
  const duration = milestone ? 7000 : 4000;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // fireworks every day (streak rotates the colors); milestones explode
    const stop = runConfetti(canvas, streak, milestone != null, duration);
    return stop;
  }, [streak, milestone, duration]);

  // Count the streak number up after a beat.
  useEffect(() => {
    const id = setTimeout(() => setShown(streak), 900);
    return () => clearTimeout(id);
  }, [streak]);

  useEffect(() => {
    const id = setTimeout(onDismiss, duration);
    return () => clearTimeout(id);
  }, [onDismiss, duration]);

  return (
    <div
      className={`fixed inset-0 z-50 flex flex-col items-center justify-center ${
        milestone ? "celebration-bg-gold" : "celebration-bg"
      }`}
      onClick={onDismiss}
    >
      <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
      <div className="pointer-events-none relative flex flex-col items-center gap-2 text-white">
        {milestone ? (
          <>
            <div className="pop-in text-7xl">{MILESTONE_EMOJI[milestone] ?? "🎖️"}</div>
            <div className="pop-in text-3xl font-black tracking-wide">
              {milestone} DAYS!
            </div>
          </>
        ) : (
          <div className="pop-in text-4xl font-black">Day complete!</div>
        )}
        <div
          key={shown}
          className={`streak-glow text-[9rem] font-black leading-none ${
            shown === streak ? "count-pop" : ""
          }`}
        >
          {shown}
        </div>
        <div className="text-2xl font-bold text-white/90">day streak</div>
      </div>
    </div>
  );
}
