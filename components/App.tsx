"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppData, SIT_DURATION_MS, SitWindow } from "@/lib/types";
import { creditSit, recordCancelledSit, windowState } from "@/lib/logic";
import { loadData, saveData } from "@/lib/storage";
import { ensureAudio, playCelebration, playMilestone, playSitDone, playTimerDone } from "@/lib/sound";
import { MainScreen } from "./MainScreen";
import { TimerScreen } from "./TimerScreen";
import { Celebration } from "./Celebration";
import { SitDoneOverlay } from "./SitDoneOverlay";
import { ParentPanel } from "./ParentPanel";

type Overlay =
  | { type: "sitDone"; window: SitWindow }
  | { type: "celebration"; streak: number; milestone: number | null }
  | null;

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [parentOpen, setParentOpen] = useState(false);
  const completing = useRef(false);

  const commit = useCallback((next: AppData) => {
    setData(next);
    saveData(next);
  }, []);

  // Stable dismiss: the overlays arm auto-dismiss timers keyed on this
  // callback, and the app re-renders every second on the clock tick.
  const dismissOverlay = useCallback(() => setOverlay(null), []);

  useEffect(() => {
    setData(loadData());
  }, []);

  // Clock tick: everything derives from Date.now(), never a ticking counter.
  useEffect(() => {
    const tick = () => setNow(Date.now());
    const id = setInterval(tick, 1000);
    const onVisible = () => {
      if (document.visibilityState === "visible") tick();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", tick);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", tick);
    };
  }, []);

  // Timer completion: fires whether the app stayed open or was just reopened
  // past the 5:00 mark (remaining time is recomputed from the start timestamp).
  useEffect(() => {
    if (!data?.activeTimer || completing.current) return;
    const t = data.activeTimer;
    if (now - t.startedAt < SIT_DURATION_MS) return;
    completing.current = true;
    const result = creditSit(data, t.window, t.dateKey, t.startedAt);
    commit(result.data);
    playTimerDone();
    if (result.dayCompleted) {
      const variant = result.data.meta.celebration_index;
      setOverlay({ type: "celebration", streak: result.newStreak, milestone: result.milestone });
      setTimeout(() => {
        if (result.milestone) playMilestone();
        else playCelebration(variant);
      }, 700);
    } else {
      setOverlay({ type: "sitDone", window: t.window });
      setTimeout(() => playSitDone(), 600);
    }
    completing.current = false;
  }, [data, now, commit]);

  if (!data) {
    return <main className="app-bg flex min-h-dvh items-center justify-center" />;
  }

  const ws = windowState(data, now);

  const startSit = () => {
    if (!ws.window || data.activeTimer) return;
    ensureAudio(); // user gesture: unlock audio for the chime at 0:00
    commit({
      ...data,
      activeTimer: { startedAt: Date.now(), window: ws.window, dateKey: ws.todayKey },
    });
  };

  const cancelSit = () => {
    if (!data.activeTimer) return;
    const t = data.activeTimer;
    commit(recordCancelledSit(data, t.window, t.dateKey, t.startedAt));
  };

  if (data.activeTimer) {
    return (
      <TimerScreen
        startedAt={data.activeTimer.startedAt}
        onCancel={cancelSit}
      />
    );
  }

  return (
    <>
      <MainScreen
        data={data}
        ws={ws}
        now={now}
        onStart={startSit}
        onOpenParent={() => setParentOpen(true)}
      />
      {overlay?.type === "sitDone" && (
        <SitDoneOverlay
          window={overlay.window}
          hasAfternoonLeft={overlay.window === "morning"}
          onDismiss={dismissOverlay}
        />
      )}
      {overlay?.type === "celebration" && (
        <Celebration
          streak={overlay.streak}
          milestone={overlay.milestone}
          variant={data.meta.celebration_index}
          onDismiss={dismissOverlay}
        />
      )}
      {parentOpen && (
        <ParentPanel
          data={data}
          now={now}
          onCommit={commit}
          onClose={() => setParentOpen(false)}
        />
      )}
    </>
  );
}
