// Cross-device sync: local-first, cloud catch-up.
// One jsonb row per family sync code in Supabase, reached only through two
// RPC functions (the table itself is RLS-locked, so the anon key cannot
// list rows — you must know the code). The publishable key below is public
// by design; the sync code is the secret.
import { AppData, DayRec } from "./types";
import { computeStreak } from "./logic";
import { dayKey } from "./time";

const SUPABASE_URL = "https://zwiqmrlquldhjjwbeakj.supabase.co";
const SUPABASE_KEY = "sb_publishable_7QMusP6TZR-eKN4qtgcx7g_KexkigQU";
const SYNC_ID_KEY = "sitstreak:syncid";

/** Codes are lowercase UUIDs. Normalizing + validating on every entry path
 *  prevents the typo-fork: a hand-typed "Db3c2la-..." once silently created
 *  a second family record. */
export function normalizeSyncCode(raw: string): string {
  return raw.trim().toLowerCase().replace(/\s+/g, "");
}

export function isValidSyncCode(code: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(code);
}

export function getSyncId(): string {
  let id = "";
  try {
    id = localStorage.getItem(SYNC_ID_KEY) ?? "";
    if (!id) {
      id = crypto.randomUUID();
      localStorage.setItem(SYNC_ID_KEY, id);
    }
  } catch {
    // storage unavailable; sync disabled this session
  }
  return id;
}

/** Join another device's code. Caller should pull + merge afterwards. */
export function setSyncId(code: string): void {
  try {
    localStorage.setItem(SYNC_ID_KEY, code.trim());
  } catch {
    // ignore
  }
}

async function rpc(fn: string, body: unknown): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 10_000);
  try {
    return await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
      },
      body: JSON.stringify(body),
      signal: controller.signal,
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Fetch the cloud copy for a specific code (used to verify a join target). */
export async function pullRemoteBy(code: string): Promise<AppData | null> {
  if (!code) return null;
  try {
    const res = await rpc("streakprize_get", { p_sync_id: code });
    if (!res.ok) return null;
    const json = await res.json();
    return json && typeof json === "object" ? (json as AppData) : null;
  } catch {
    return null; // offline is a normal state, never an error
  }
}

/** Fetch the cloud copy for this device's sync code. null = no row or offline. */
export async function pullRemote(): Promise<AppData | null> {
  return pullRemoteBy(getSyncId());
}

/** Push the local copy to the cloud. Fire-and-forget; offline is fine. */
export async function pushRemote(data: AppData): Promise<boolean> {
  const id = getSyncId();
  if (!id) return false;
  try {
    const res = await rpc("streakprize_put", { p_sync_id: id, p_data: data });
    return res.ok;
  } catch {
    return false;
  }
}

function mergeDay(a: DayRec | undefined, b: DayRec | undefined, date: string): DayRec {
  const morning = Boolean(a?.morning_complete) || Boolean(b?.morning_complete);
  const afternoon = Boolean(a?.afternoon_complete) || Boolean(b?.afternoon_complete);
  const manual = Boolean(a?.manually_credited) || Boolean(b?.manually_credited);
  const bonus = Boolean(a?.bonus_complete) || Boolean(b?.bonus_complete);
  return {
    date,
    morning_complete: morning,
    afternoon_complete: afternoon,
    day_complete: (morning && afternoon) || manual,
    manually_credited: manual,
    bonus_complete: bonus,
  };
}

function unionById<T extends { id: string }>(a: T[], b: T[]): T[] {
  const seen = new Map<string, T>();
  for (const x of [...a, ...b]) if (!seen.has(x.id)) seen.set(x.id, x);
  return [...seen.values()];
}

/**
 * Merge two copies of the app state. Completions are a union (a day done
 * anywhere is done everywhere — never lose a credited sit); scalar
 * preferences (settings, anchor, active timer) follow the newer copy.
 */
export function mergeData(local: AppData, remote: AppData): AppData {
  const newer = (local.updatedAt ?? 0) >= (remote.updatedAt ?? 0) ? local : remote;

  const days: Record<string, DayRec> = {};
  const keys = new Set([...Object.keys(local.days), ...Object.keys(remote.days)]);
  for (const k of keys) days[k] = mergeDay(local.days[k], remote.days[k], k);

  const merged: AppData = {
    version: 1,
    sits: unionById(local.sits, remote.sits).sort((x, y) => x.started_at - y.started_at),
    days,
    outputLog: unionById(local.outputLog, remote.outputLog).sort(
      (x, y) => x.timestamp - y.timestamp
    ),
    meta: {
      ...newer.meta,
      milestones_earned: [
        ...new Set([...local.meta.milestones_earned, ...remote.meta.milestones_earned]),
      ].sort((x, y) => x - y),
      longest_streak: Math.max(local.meta.longest_streak, remote.meta.longest_streak),
    },
    activeTimer: newer.activeTimer,
    updatedAt: Math.max(local.updatedAt ?? 0, remote.updatedAt ?? 0),
  };
  merged.meta.current_streak = computeStreak(merged, dayKey(Date.now()));
  if (merged.meta.current_streak > merged.meta.longest_streak) {
    merged.meta.longest_streak = merged.meta.current_streak;
  }
  return merged;
}

/** Cheap change detector for deciding whether a merge produced news. */
export function sameData(a: AppData, b: AppData): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}
