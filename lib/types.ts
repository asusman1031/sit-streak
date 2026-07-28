export type SitWindow = "morning" | "afternoon";

export interface Sit {
  id: string;
  date: string; // logical day key, YYYY-MM-DD in America/New_York with 4 AM rollover
  window: SitWindow;
  started_at: number;
  completed_at: number | null;
  completed: boolean;
}

export interface DayRec {
  date: string;
  morning_complete: boolean;
  afternoon_complete: boolean;
  day_complete: boolean;
  manually_credited: boolean;
}

export interface OutputEntry {
  id: string;
  timestamp: number;
  occurred: boolean;
  note: string;
}

export interface StreakAnchor {
  // Asserts: as of the end of `date`, the streak was `value`.
  // Set by the parent panel's manual streak adjustment.
  date: string;
  value: number;
}

export interface Settings {
  morningEnd: string; // "HH:MM", morning sit completable before this time
  afternoonStart: string; // "HH:MM", afternoon sit completable after this time
  flushFx: boolean; // Sawyer's dancing-poop flush finale at 0:00 (parent can disable)
}

export interface Meta {
  current_streak: number; // last computed value, persisted for export; derived at runtime
  longest_streak: number;
  milestones_earned: number[];
  anchor: StreakAnchor | null;
  settings: Settings;
  celebration_index: number; // rotates celebration variants
}

export interface ActiveTimer {
  startedAt: number;
  window: SitWindow;
  dateKey: string;
}

export interface AppData {
  version: 1;
  sits: Sit[];
  days: Record<string, DayRec>;
  outputLog: OutputEntry[];
  meta: Meta;
  activeTimer: ActiveTimer | null;
}

export const SIT_DURATION_MS = 5 * 60 * 1000;
// Sawyer's rule: every 10 days is a fireworks milestone.
export const MILESTONES = [10, 20, 30, 40, 50, 60, 70, 80, 90, 100];

export const MILESTONE_EMOJI: Record<number, string> = {
  10: "🌟",
  20: "🏅",
  30: "🏆",
  40: "👑",
  50: "🚀",
  60: "🎆",
  70: "💎",
  80: "🪩",
  90: "🦄",
  100: "🏰",
};

export const DEFAULT_SETTINGS: Settings = {
  morningEnd: "09:00",
  afternoonStart: "15:00",
  flushFx: true,
};

export function emptyData(): AppData {
  return {
    version: 1,
    sits: [],
    days: {},
    outputLog: [],
    meta: {
      current_streak: 0,
      longest_streak: 0,
      milestones_earned: [],
      anchor: null,
      settings: { ...DEFAULT_SETTINGS },
      celebration_index: 0,
    },
    activeTimer: null,
  };
}
