// All day/window math runs in America/New_York with a 4:00 AM day rollover.
// Never trust a locally-ticking counter: everything derives from epoch ms.

export const TZ = "America/New_York";
export const ROLLOVER_HOUR = 4;

interface NYParts {
  y: number;
  mo: number; // 1-12
  d: number;
  hh: number;
  mm: number;
}

const partsFmt = new Intl.DateTimeFormat("en-US", {
  timeZone: TZ,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});

export function nyParts(epochMs: number): NYParts {
  const parts: Record<string, string> = {};
  for (const p of partsFmt.formatToParts(new Date(epochMs))) {
    parts[p.type] = p.value;
  }
  return {
    y: Number(parts.year),
    mo: Number(parts.month),
    d: Number(parts.day),
    hh: Number(parts.hour) % 24, // some engines emit "24" for midnight
    mm: Number(parts.minute),
  };
}

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

/** Logical day key: the NY calendar date as of 4 hours ago (4 AM rollover). */
export function dayKey(epochMs: number): string {
  const p = nyParts(epochMs - ROLLOVER_HOUR * 3600_000);
  return `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
}

/** Previous/next calendar day for a YYYY-MM-DD key (pure date math, TZ-free). */
export function addDays(key: string, delta: number): string {
  const [y, m, d] = key.split("-").map(Number);
  const t = Date.UTC(y, m - 1, d + delta);
  const dt = new Date(t);
  return `${dt.getUTCFullYear()}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Epoch ms for a NY wall-clock time on a given calendar date. DST-safe via refinement. */
export function nyEpoch(dateKey: string, hhmm: string): number {
  const [y, m, d] = dateKey.split("-").map(Number);
  const [hh, mm] = hhmm.split(":").map(Number);
  const target = Date.UTC(y, m - 1, d, hh, mm);
  let t = target;
  for (let i = 0; i < 3; i++) {
    const p = nyParts(t);
    const cur = Date.UTC(p.y, p.mo - 1, p.d, p.hh, p.mm);
    if (cur === target) break;
    t += target - cur;
  }
  return t;
}

/**
 * Minutes elapsed into the logical day (which starts at 4:00 AM NY).
 * Times after midnight but before 4 AM read as 24:00+ of the previous date.
 */
export function minutesIntoDay(epochMs: number): number {
  const p = nyParts(epochMs);
  const calDate = `${p.y}-${pad(p.mo)}-${pad(p.d)}`;
  const wrapped = calDate !== dayKey(epochMs);
  return p.hh * 60 + p.mm + (wrapped ? 1440 : 0);
}

export function hhmmToMinutes(hhmm: string): number {
  const [hh, mm] = hhmm.split(":").map(Number);
  return hh * 60 + mm;
}

/** Format ms as M:SS for the countdown. */
export function formatCountdown(ms: number): string {
  const total = Math.max(0, Math.ceil(ms / 1000));
  const m = Math.floor(total / 60);
  const s = total % 60;
  return `${m}:${pad(s)}`;
}

/** Format ms as a friendly "2h 14m" / "14m" wait string. */
export function formatWait(ms: number): string {
  const totalMin = Math.max(1, Math.ceil(ms / 60000));
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  if (h > 0) return `${h}h ${m}m`;
  return `${m}m`;
}

/** Friendly clock label like "3 o'clock" or "3:30" for copy. */
export function friendlyClock(hhmm: string): string {
  const [hh, mm] = hhmm.split(":").map(Number);
  const h12 = ((hh + 11) % 12) + 1;
  return mm === 0 ? `${h12} o'clock` : `${h12}:${pad(mm)}`;
}
