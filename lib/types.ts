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
export const MILESTONES = [3, 7, 14, 30, 60];

export const DEFAULT_SETTINGS: Settings = {
  morningEnd: "09:00",
  afternoonStart: "15:00",
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
