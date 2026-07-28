import {
  AppData,
  DayRec,
  MILESTONES,
  SIT_DURATION_MS,
  Sit,
  SitWindow,
} from "./types";
import {
  addDays,
  dayKey,
  hhmmToMinutes,
  minutesIntoDay,
  nyEpoch,
} from "./time";

export function newId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function getDay(data: AppData, key: string): DayRec {
  return (
    data.days[key] ?? {
      date: key,
      morning_complete: false,
      afternoon_complete: false,
      day_complete: false,
      manually_credited: false,
    }
  );
}

/**
 * Streak = consecutive complete days ending at today (if complete) or yesterday.
 * The parent-panel anchor asserts "as of the end of anchor.date the streak was
 * anchor.value"; the walk-back stops there and adds it. A gap before the anchor
 * invalidates it naturally. Completed day records are never deleted, so a device
 * clock change cannot erase history.
 */
export function computeStreak(data: AppData, todayKey: string): number {
  const anchor = data.meta.anchor;
  let streak = 0;
  let d = todayKey;
  if (!getDay(data, d).day_complete && !(anchor && anchor.date === d)) {
    d = addDays(d, -1);
  }
  // Bounded walk: streaks are finite; 10 years is a safe ceiling.
  for (let i = 0; i < 3660; i++) {
    if (anchor && anchor.date === d) {
      streak += anchor.value;
      break;
    }
    if (getDay(data, d).day_complete) {
      streak++;
      d = addDays(d, -1);
    } else {
      break;
    }
  }
  return streak;
}

export interface WindowState {
  window: SitWindow | null; // which window is open right now, if any
  morningDone: boolean;
  afternoonDone: boolean;
  dayComplete: boolean;
  unlockAt: number | null; // epoch ms when the afternoon window opens (mid-day)
  todayKey: string;
}

export function windowState(data: AppData, now: number): WindowState {
  const todayKey = dayKey(now);
  const day = getDay(data, todayKey);
  const mins = minutesIntoDay(now);
  const morningEnd = hhmmToMinutes(data.meta.settings.morningEnd);
  const afternoonStart = hhmmToMinutes(data.meta.settings.afternoonStart);

  let window: SitWindow | null = null;
  if (mins < morningEnd && !day.morning_complete) window = "morning";
  else if (mins >= afternoonStart && !day.afternoon_complete)
    window = "afternoon";

  // No sit available now, but the afternoon one is still coming today:
  // covers both mid-day and "morning done before 9 AM".
  const unlockAt =
    window === null && !day.afternoon_complete && mins < afternoonStart
      ? nyEpoch(todayKey, data.meta.settings.afternoonStart)
      : null;

  return {
    window,
    morningDone: day.morning_complete,
    afternoonDone: day.afternoon_complete,
    dayComplete: day.day_complete,
    unlockAt,
    todayKey,
  };
}

export interface CompletionResult {
  data: AppData;
  dayCompleted: boolean;
  newStreak: number;
  milestone: number | null;
}

/** Credit a finished 5:00 sit. Guards against double-crediting a window. */
export function creditSit(
  data: AppData,
  sitWindow: SitWindow,
  dateKey: string,
  startedAt: number
): CompletionResult {
  const next: AppData = structuredClone(data);
  const day = getDay(next, dateKey);

  const sit: Sit = {
    id: newId(),
    date: dateKey,
    window: sitWindow,
    started_at: startedAt,
    completed_at: startedAt + SIT_DURATION_MS,
    completed: true,
  };
  next.sits.push(sit);

  const alreadyCredited =
    sitWindow === "morning" ? day.morning_complete : day.afternoon_complete;
  if (alreadyCredited) {
    next.activeTimer = null;
    return { data: next, dayCompleted: false, newStreak: next.meta.current_streak, milestone: null };
  }

  if (sitWindow === "morning") day.morning_complete = true;
  else day.afternoon_complete = true;

  const wasComplete = day.day_complete;
  day.day_complete = day.morning_complete && day.afternoon_complete;
  next.days[dateKey] = day;
  next.activeTimer = null;

  const dayCompleted = day.day_complete && !wasComplete;
  const newStreak = computeStreak(next, dateKey);
  next.meta.current_streak = newStreak;
  if (newStreak > next.meta.longest_streak) next.meta.longest_streak = newStreak;

  let milestone: number | null = null;
  if (dayCompleted && MILESTONES.includes(newStreak) &&
      !next.meta.milestones_earned.includes(newStreak)) {
    next.meta.milestones_earned.push(newStreak);
    milestone = newStreak;
  }
  if (dayCompleted) {
    next.meta.celebration_index = (next.meta.celebration_index + 1) % 4;
  }

  return { data: next, dayCompleted, newStreak, milestone };
}

/** Log a cancelled sit (no penalty; data is useful for the export). */
export function recordCancelledSit(
  data: AppData,
  sitWindow: SitWindow,
  dateKey: string,
  startedAt: number
): AppData {
  const next: AppData = structuredClone(data);
  next.sits.push({
    id: newId(),
    date: dateKey,
    window: sitWindow,
    started_at: startedAt,
    completed_at: null,
    completed: false,
  });
  next.activeTimer = null;
  return next;
}

/** Parent panel: credit a whole day manually (travel, illness, real life). */
export function creditDayManually(data: AppData, dateKey: string): AppData {
  const next: AppData = structuredClone(data);
  const day = getDay(next, dateKey);
  day.morning_complete = true;
  day.afternoon_complete = true;
  day.day_complete = true;
  day.manually_credited = true;
  next.days[dateKey] = day;
  const streak = computeStreak(next, dayKey(Date.now()));
  next.meta.current_streak = streak;
  if (streak > next.meta.longest_streak) next.meta.longest_streak = streak;
  return next;
}

/** Parent panel: set the streak count directly via the anchor. */
export function setStreakManually(data: AppData, value: number, now: number): AppData {
  const next: AppData = structuredClone(data);
  const todayKey = dayKey(now);
  const todayComplete = getDay(next, todayKey).day_complete;
  next.meta.anchor = {
    date: todayComplete ? todayKey : addDays(todayKey, -1),
    value: Math.max(0, Math.floor(value)),
  };
  const streak = computeStreak(next, todayKey);
  next.meta.current_streak = streak;
  if (streak > next.meta.longest_streak) next.meta.longest_streak = streak;
  return next;
}
