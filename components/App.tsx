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
import { FlushOverlay } from "./FlushOverlay";
import { ParentPanel } from "./ParentPanel";

type Reward =
  | { type: "sitDone"; window: SitWindow }
  | { type: "celebration"; streak: number; milestone: number | null; variant: number };

type Overlay = Reward | { type: "flush"; after: Reward } | null;

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

  // Show a reward screen and play its sound.
  const showReward = useCallback((reward: Reward) => {
    setOverlay(reward);
    if (reward.type === "celebration") {
      setTimeout(() => {
        if (reward.milestone) playMilestone();
        else playCelebration(reward.variant);
      }, 500);
    } else {
      setTimeout(() => playSitDone(), 400);
    }
  }, []);

  // The flush finale hands off to whichever reward comes next.
  const flushDone = useCallback(
    (after: Reward) => () => showReward(after),
    [showReward]
  );

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
    const reward: Reward = result.dayCompleted
      ? {
          type: "celebration",
          streak: result.newStreak,
          milestone: result.milestone,
          variant: result.data.meta.celebration_index,
        }
      : { type: "sitDone", window: t.window };
    if (data.meta.settings.flushFx) {
      // Sawyer's finale: dancing poop, flush, swirl out — then the reward.
      setOverlay({ type: "flush", after: reward });
    } else {
      playTimerDone();
      showReward(reward);
    }
    completing.current = false;
  }, [data, now, commit, showReward]);

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
      {overlay?.type === "flush" && <FlushOverlay onDone={flushDone(overlay.after)} />}
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
