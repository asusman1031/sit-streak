"use client";

import { useRef } from "react";
import { AppData, MILESTONE_EMOJI } from "@/lib/types";
import { WindowState } from "@/lib/logic";
import { formatWait, friendlyClock } from "@/lib/time";

interface Props {
  data: AppData;
  ws: WindowState;
  now: number;
  onStart: () => void;
  onOpenParent: () => void;
}

export function MainScreen({ data, ws, now, onStart, onOpenParent }: Props) {
  const streak = data.meta.current_streak;
  const longest = data.meta.longest_streak;
  const newStreakState = streak === 0;

  // Parent panel gestures: long-press the streak, or 5 rapid corner taps.
  const pressTimer = useRef<number | null>(null);
  const cornerTaps = useRef<number[]>([]);

  const pressStart = () => {
    pressTimer.current = window.setTimeout(onOpenParent, 900);
  };
  const pressEnd = () => {
    if (pressTimer.current != null) {
      clearTimeout(pressTimer.current);
      pressTimer.current = null;
    }
  };
  const cornerTap = () => {
    const t = Date.now();
    cornerTaps.current = [...cornerTaps.current.filter((x) => t - x < 2500), t];
    if (cornerTaps.current.length >= 5) {
      cornerTaps.current = [];
      onOpenParent();
    }
  };

  return (
    <main className="app-bg relative flex min-h-dvh flex-col items-center px-6 pb-10 pt-14 text-white">
      {/* invisible parent-panel hotspot */}
      <button
        aria-hidden
        tabIndex={-1}
        onClick={cornerTap}
        className="absolute right-0 top-0 z-10 h-16 w-16 opacity-0"
      />

      {/* Streak header */}
      <div
        className="flex select-none flex-col items-center"
        onPointerDown={pressStart}
        onPointerUp={pressEnd}
        onPointerLeave={pressEnd}
        onContextMenu={(e) => e.preventDefault()}
      >
        {newStreakState ? (
          <>
            <div className="text-7xl font-black leading-none">0</div>
            <div className="mt-2 text-xl font-bold text-white/90">
              Start a new streak
            </div>
          </>
        ) : (
          <>
            <div className="streak-glow text-8xl font-black leading-none">
              {streak}
            </div>
            <div className="mt-2 text-xl font-bold text-white/90">
              day streak {streak >= 3 ? "🔥" : ""}
            </div>
          </>
        )}
        {longest > 0 && (
          <div className="mt-1 text-sm font-medium text-white/50">
            best: {longest}
          </div>
        )}
      </div>

      {/* Today's two slots */}
      <div className="mt-8 flex items-center gap-6">
        <Slot label="Morning" done={ws.morningDone} />
        <Slot label="Afternoon" done={ws.afternoonDone} />
      </div>

      {/* Milestone badges */}
      {data.meta.milestones_earned.length > 0 && (
        <div className="mt-5 flex items-center gap-2 rounded-full bg-white/10 px-4 py-2">
          {[...data.meta.milestones_earned].sort((a, b) => a - b).map((m) => (
            <span key={m} className="text-xl" title={`${m} days`}>
              {MILESTONE_EMOJI[m] ?? "🎖️"}
            </span>
          ))}
        </div>
      )}

      {/* Main action area */}
      <div className="flex w-full max-w-sm flex-1 flex-col items-center justify-center">
        <ActionArea data={data} ws={ws} now={now} onStart={onStart} />
      </div>
    </main>
  );
}

function Slot({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex flex-col items-center gap-1.5">
      <div
        className={`flex h-14 w-14 items-center justify-center rounded-full border-4 text-2xl transition-all ${
          done
            ? "border-emerald-300 bg-emerald-400/90 shadow-lg shadow-emerald-500/40"
            : "border-white/40 bg-white/10"
        }`}
      >
        {done ? "✓" : ""}
      </div>
      <div className="text-xs font-semibold uppercase tracking-wide text-white/70">
        {label}
      </div>
    </div>
  );
}

function ActionArea({
  data,
  ws,
  now,
  onStart,
}: {
  data: AppData;
  ws: WindowState;
  now: number;
  onStart: () => void;
}) {
  const afternoonLabel = friendlyClock(data.meta.settings.afternoonStart);

  if (ws.dayComplete) {
    return (
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="text-6xl">🎉</div>
        <div className="text-3xl font-extrabold">You did it!</div>
        <div className="text-lg text-white/80">
          Both sits done. See you tomorrow!
        </div>
      </div>
    );
  }

  if (ws.window) {
    return (
      <div className="flex w-full flex-col items-center gap-4">
        <button
          onClick={onStart}
          className="big-button w-full rounded-3xl bg-amber-400 px-8 py-8 text-3xl font-black text-amber-950 shadow-xl shadow-amber-500/40 transition-transform active:scale-95"
        >
          Start my 5 minutes
        </button>
        <div className="text-base font-semibold text-white/70">
          {ws.window === "morning" ? "Morning sit" : "Afternoon sit"}
        </div>
      </div>
    );
  }

  if (ws.unlockAt != null) {
    // Locked until the afternoon window. Friendly, never an error, and
    // no commentary if the morning was missed.
    const waitMs = Math.max(0, ws.unlockAt - now);
    return (
      <div className="flex w-full flex-col items-center gap-4 text-center">
        <div className="text-2xl font-extrabold">
          {ws.morningDone
            ? `Next one after ${afternoonLabel}`
            : `Afternoon sit unlocks at ${afternoonLabel}`}
        </div>
        <div className="rounded-full bg-white/10 px-5 py-2 text-lg font-bold text-white/80">
          ⏳ {formatWait(waitMs)}
        </div>
        <button
          disabled
          className="w-full cursor-not-allowed rounded-3xl bg-white/15 px-8 py-8 text-3xl font-black text-white/40"
        >
          Start my 5 minutes
        </button>
      </div>
    );
  }

  // Evening, nothing left today (afternoon done, morning window long gone).
  return (
    <div className="flex flex-col items-center gap-3 text-center">
      <div className="text-5xl">🌙</div>
      <div className="text-2xl font-extrabold">That&apos;s it for today</div>
      <div className="text-lg text-white/80">See you tomorrow!</div>
    </div>
  );
}
