"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AppData, SitWindow, durationFor } from "@/lib/types";
import { creditSit, recordCancelledSit, windowState } from "@/lib/logic";
import { loadData, normalizeData, saveData, wipeLocal } from "@/lib/storage";
import {
  isLoggedIn,
  isValidSyncCode,
  markLoggedIn,
  mergeData,
  normalizeSyncCode,
  pullRemote,
  pushRemote,
  sameData,
  setSyncId,
} from "@/lib/sync";
import { LoginScreen } from "./LoginScreen";
import { ensureAudio, playCelebration, playMilestone, playSitDone, playTimerDone } from "@/lib/sound";
import { MainScreen } from "./MainScreen";
import { TimerScreen } from "./TimerScreen";
import { Celebration } from "./Celebration";
import { SitDoneOverlay } from "./SitDoneOverlay";
import { FlushOverlay } from "./FlushOverlay";
import { ParentPanel } from "./ParentPanel";

type Reward =
  | { type: "sitDone"; window: SitWindow }
  | { type: "celebration"; streak: number; prev: number; milestone: number | null; variant: number };

type Overlay = Reward | { type: "flush"; after: Reward } | null;

export default function App() {
  const [data, setData] = useState<AppData | null>(null);
  const [now, setNow] = useState(() => Date.now());
  const [overlay, setOverlay] = useState<Overlay>(null);
  const [parentOpen, setParentOpen] = useState(false);
  const [authed, setAuthed] = useState(false);
  const completing = useRef(false);
  const dataRef = useRef<AppData | null>(null);
  dataRef.current = data;
  const pushTimer = useRef<number | null>(null);

  // Debounced cloud push: local save is instant, sync trails by a beat.
  const schedulePush = useCallback(() => {
    if (pushTimer.current != null) clearTimeout(pushTimer.current);
    pushTimer.current = window.setTimeout(() => {
      if (dataRef.current) void pushRemote(dataRef.current);
    }, 1500);
  }, []);

  const commit = useCallback(
    (next: AppData) => {
      setData(next);
      saveData(next);
      schedulePush();
    },
    [schedulePush]
  );

  // Pull the cloud copy and fold it in. Offline quietly does nothing.
  const syncPull = useCallback(async () => {
    const remoteRaw = await pullRemote();
    if (!remoteRaw) return;
    const local = dataRef.current;
    if (!local) return;
    const remote = normalizeData(remoteRaw);
    const merged = mergeData(local, remote);
    if (!sameData(merged, local)) {
      setData(merged);
      saveData(merged);
    }
    if (!sameData(merged, remote)) void pushRemote(merged);
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
    // Join link: /?join=<code> adopts that family sync code before the first
    // pull; codes are normalized and validated so a mangled link can't fork
    // the family record. /?join=<code>&fresh=1 also wipes this device's
    // local state first — a clean adopt with no merge residue.
    try {
      const params = new URLSearchParams(window.location.search);
      const code = normalizeSyncCode(params.get("join") ?? "");
      if (code && isValidSyncCode(code)) {
        if (params.get("fresh") === "1") wipeLocal();
        setSyncId(code);
        markLoggedIn(); // a join link is an identity assertion
      }
      if (params.get("join")) window.history.replaceState({}, "", "/");
    } catch {
      // ignore malformed URLs
    }
    setAuthed(isLoggedIn());
    const d = loadData();
    dataRef.current = d;
    setData(d);
    void syncPull();
  }, [syncPull]);

  // Keep devices converging: re-pull when the app comes forward and each
  // minute while visible.
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible") void syncPull();
    };
    const id = setInterval(() => {
      if (document.visibilityState === "visible") void syncPull();
    }, 60_000);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [syncPull]);

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
  // past the end mark (remaining time is recomputed from the start timestamp).
  useEffect(() => {
    if (!data?.activeTimer || completing.current) return;
    const t = data.activeTimer;
    if (now - t.startedAt < durationFor(t.window)) return;
    completing.current = true;
    const result = creditSit(data, t.window, t.dateKey, t.startedAt);
    commit(result.data);
    // Day complete or a milestone crossed (a bonus can do that) -> full
    // celebration; otherwise the short confirmation.
    const reward: Reward =
      result.dayCompleted || result.milestone
        ? {
            type: "celebration",
            streak: result.newStreak,
            prev: data.meta.current_streak,
            milestone: result.milestone,
            variant: result.data.meta.celebration_index,
          }
        : { type: "sitDone", window: t.window };
    if (data.meta.settings.flushFx) {
      // The finale: dancing poop, flush, swirl out — then the reward.
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

  // Un-identified device: family login before anything else. Existing
  // local data rides along and merges in.
  if (!authed) {
    return (
      <LoginScreen
        data={data}
        onDone={(merged) => {
          commit(merged);
          setAuthed(true);
        }}
      />
    );
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

  const startBonus = () => {
    if (!ws.bonusAvailable || data.activeTimer) return;
    ensureAudio();
    commit({
      ...data,
      activeTimer: { startedAt: Date.now(), window: "bonus", dateKey: ws.todayKey },
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
        durationMs={durationFor(data.activeTimer.window)}
        bonus={data.activeTimer.window === "bonus"}
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
        onStartBonus={startBonus}
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
          prev={overlay.prev}
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
