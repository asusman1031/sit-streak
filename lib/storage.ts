import { AppData, DEFAULT_SETTINGS, emptyData } from "./types";

const KEY = "sitstreak:v1";
const BACKUP_PREFIX = "sitstreak:backup:";
const MAX_BACKUPS = 12;

/** Fill in any fields missing from older saves so loads never crash. */
function normalize(raw: unknown): AppData {
  const base = emptyData();
  if (!raw || typeof raw !== "object") return base;
  const d = raw as Partial<AppData>;
  return {
    version: 1,
    sits: Array.isArray(d.sits) ? d.sits : [],
    days: d.days && typeof d.days === "object" ? d.days : {},
    outputLog: Array.isArray(d.outputLog) ? d.outputLog : [],
    meta: {
      ...base.meta,
      ...(d.meta ?? {}),
      settings: { ...DEFAULT_SETTINGS, ...(d.meta?.settings ?? {}) },
      milestones_earned: d.meta?.milestones_earned ?? [],
    },
    activeTimer: d.activeTimer ?? null,
  };
}

export function loadData(): AppData {
  try {
    const raw = localStorage.getItem(KEY);
    if (raw) return normalize(JSON.parse(raw));
  } catch {
    // fall through to backups
  }
  // Primary missing or corrupt: try the newest backup before starting fresh.
  try {
    const backups = listBackups();
    if (backups.length > 0) {
      const raw = localStorage.getItem(backups[0].key);
      if (raw) return normalize(JSON.parse(raw));
    }
  } catch {
    // give up, start fresh
  }
  return emptyData();
}

/** Every save also writes a timestamped backup key; a cleared primary key
 *  (or a bad write) can be recovered from the most recent backup. */
export function saveData(data: AppData): void {
  const json = JSON.stringify(data);
  try {
    localStorage.setItem(KEY, json);
    localStorage.setItem(`${BACKUP_PREFIX}${Date.now()}`, json);
    pruneBackups();
  } catch {
    // Quota exceeded: drop old backups and retry the primary write once.
    try {
      pruneBackups(2);
      localStorage.setItem(KEY, json);
    } catch {
      // nothing more we can do client-side
    }
  }
}

export function listBackups(): { key: string; ts: number }[] {
  const out: { key: string; ts: number }[] = [];
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (k && k.startsWith(BACKUP_PREFIX)) {
      out.push({ key: k, ts: Number(k.slice(BACKUP_PREFIX.length)) });
    }
  }
  return out.sort((a, b) => b.ts - a.ts);
}

function pruneBackups(keep: number = MAX_BACKUPS): void {
  for (const b of listBackups().slice(keep)) {
    localStorage.removeItem(b.key);
  }
}

export function restoreLatestBackup(): AppData | null {
  const backups = listBackups();
  for (const b of backups) {
    try {
      const raw = localStorage.getItem(b.key);
      if (raw) {
        const data = normalize(JSON.parse(raw));
        saveData(data);
        return data;
      }
    } catch {
      continue;
    }
  }
  return null;
}

// ---------- Export ----------

export function exportJSON(data: AppData): string {
  return JSON.stringify(data, null, 2);
}

function csvEscape(v: unknown): string {
  const s = String(v ?? "");
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function iso(ts: number | null): string {
  return ts == null ? "" : new Date(ts).toISOString();
}

/** One CSV with clearly separated sections: days, sits, output log, meta. */
export function exportCSV(data: AppData): string {
  const lines: string[] = [];

  lines.push("DAYS");
  lines.push("date,morning_complete,afternoon_complete,day_complete,manually_credited");
  for (const key of Object.keys(data.days).sort()) {
    const d = data.days[key];
    lines.push(
      [d.date, d.morning_complete, d.afternoon_complete, d.day_complete, d.manually_credited]
        .map(csvEscape)
        .join(",")
    );
  }

  lines.push("");
  lines.push("SITS");
  lines.push("id,date,window,started_at,completed_at,completed");
  for (const s of data.sits) {
    lines.push(
      [s.id, s.date, s.window, iso(s.started_at), iso(s.completed_at), s.completed]
        .map(csvEscape)
        .join(",")
    );
  }

  lines.push("");
  lines.push("OUTPUT_LOG");
  lines.push("id,timestamp,occurred,note");
  for (const e of data.outputLog) {
    lines.push([e.id, iso(e.timestamp), e.occurred, e.note].map(csvEscape).join(","));
  }

  lines.push("");
  lines.push("META");
  lines.push("current_streak,longest_streak,milestones_earned");
  lines.push(
    [
      data.meta.current_streak,
      data.meta.longest_streak,
      data.meta.milestones_earned.join(" "),
    ]
      .map(csvEscape)
      .join(",")
  );

  return lines.join("\n");
}

export function downloadFile(filename: string, content: string, mime: string): void {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
