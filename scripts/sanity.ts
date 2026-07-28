// Sanity checks for the day/window/streak logic. Run: npm run sanity
import { addDays, dayKey, formatCountdown, minutesIntoDay, nyEpoch } from "../lib/time";
import { computeStreak, creditDayManually, creditSit, setStreakManually, windowState } from "../lib/logic";
import { AppData, emptyData } from "../lib/types";

let failures = 0;
function check(name: string, actual: unknown, expected: unknown): void {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) {
    failures++;
    console.error(`FAIL ${name}: got ${JSON.stringify(actual)}, want ${JSON.stringify(expected)}`);
  } else {
    console.log(`ok   ${name}`);
  }
}

// --- day rollover at 4 AM NY ---
// 2026-07-28 03:00 EDT = 07:00 UTC -> still logical day 2026-07-27
check("3am is previous day", dayKey(Date.UTC(2026, 6, 28, 7, 0)), "2026-07-27");
// 2026-07-28 04:30 EDT = 08:30 UTC -> 2026-07-28
check("4:30am is same day", dayKey(Date.UTC(2026, 6, 28, 8, 30)), "2026-07-28");
// 11:50 PM EDT July 28 = 03:50 UTC July 29 -> still July 28
check("11:50pm credits same day", dayKey(Date.UTC(2026, 6, 29, 3, 50)), "2026-07-28");

// --- DST: EST in January (UTC-5) ---
// 2026-01-15 03:59 EST = 08:59 UTC -> Jan 14
check("EST 3:59am is previous day", dayKey(Date.UTC(2026, 0, 15, 8, 59)), "2026-01-14");
check("EST 4:00am is same day", dayKey(Date.UTC(2026, 0, 15, 9, 0)), "2026-01-15");

// --- minutesIntoDay wraps past midnight ---
// 2:00 AM EDT July 29 -> logical day July 28, minutes = 2*60 + 1440
check("2am minutesIntoDay", minutesIntoDay(Date.UTC(2026, 6, 29, 6, 0)), 120 + 1440);
// 8:00 AM EDT
check("8am minutesIntoDay", minutesIntoDay(Date.UTC(2026, 6, 28, 12, 0)), 480);

// --- nyEpoch round-trips ---
// 3 PM EDT on 2026-07-28 = 19:00 UTC
check("nyEpoch 3pm EDT", nyEpoch("2026-07-28", "15:00"), Date.UTC(2026, 6, 28, 19, 0));
// 3 PM EST on 2026-01-15 = 20:00 UTC
check("nyEpoch 3pm EST", nyEpoch("2026-01-15", "15:00"), Date.UTC(2026, 0, 15, 20, 0));

check("addDays month boundary", addDays("2026-07-31", 1), "2026-08-01");
check("addDays backward", addDays("2026-03-01", -1), "2026-02-28");
check("countdown format", formatCountdown(299_000), "4:59");

// --- window state machine ---
function dataWith(days: Record<string, Partial<AppData["days"][string]>>): AppData {
  const d = emptyData();
  for (const [k, v] of Object.entries(days)) {
    d.days[k] = {
      date: k,
      morning_complete: false,
      afternoon_complete: false,
      day_complete: false,
      manually_credited: false,
      ...v,
    };
  }
  return d;
}

const at = (h: number, m = 0) => Date.UTC(2026, 6, 28, h + 4, m); // EDT: UTC-4

{
  const d = dataWith({});
  check("7am fresh -> morning open", windowState(d, at(7)).window, "morning");
  check("10am fresh -> locked, missed copy", windowState(d, at(10)).window, null);
  check("10am fresh -> unlockAt 3pm", windowState(d, at(10)).unlockAt, nyEpoch("2026-07-28", "15:00"));
  check("4pm fresh -> afternoon open", windowState(d, at(16)).window, "afternoon");
  // 2 AM next calendar day, still logical July 28: afternoon open
  check("2am -> afternoon of prev day", windowState(d, Date.UTC(2026, 6, 29, 6, 0)).window, "afternoon");
}
{
  const d = dataWith({ "2026-07-28": { morning_complete: true } });
  check("8am morning done -> locked w/ countdown", windowState(d, at(8)).unlockAt, nyEpoch("2026-07-28", "15:00"));
  check("noon morning done -> locked", windowState(d, at(12)).window, null);
}

// --- crediting and streaks ---
{
  let d = dataWith({
    "2026-07-25": { morning_complete: true, afternoon_complete: true, day_complete: true },
    "2026-07-26": { morning_complete: true, afternoon_complete: true, day_complete: true },
    "2026-07-27": { morning_complete: true, afternoon_complete: true, day_complete: true },
  });
  // morning sit at 7 AM
  let r = creditSit(d, "morning", "2026-07-28", at(7));
  check("first sit no day-complete", r.dayCompleted, false);
  d = r.data;
  // afternoon sit
  r = creditSit(d, "afternoon", "2026-07-28", at(16));
  check("second sit completes day", r.dayCompleted, true);
  check("streak 4 after completion", r.newStreak, 4);
  check("no milestone at 4", r.milestone, null);
  // double credit guard
  const before = r.data.meta.current_streak;
  const r2 = creditSit(r.data, "afternoon", "2026-07-28", at(17));
  check("double credit guarded", r2.dayCompleted, false);
  check("streak unchanged on double credit", r2.data.meta.current_streak, before);
}

// milestone at 10 (Sawyer's rule), none at 3
{
  const nine: Record<string, Partial<AppData["days"][string]>> = {
    "2026-07-28": { morning_complete: true },
  };
  for (let i = 1; i <= 9; i++) {
    const key = `2026-07-${String(28 - i).padStart(2, "0")}`;
    nine[key] = { day_complete: true, morning_complete: true, afternoon_complete: true };
  }
  const r = creditSit(dataWith(nine), "afternoon", "2026-07-28", at(16));
  check("streak 10 after completion", r.newStreak, 10);
  check("milestone at 10", r.milestone, 10);
  check("milestones_earned", r.data.meta.milestones_earned, [10]);
}
{
  const d = dataWith({
    "2026-07-26": { day_complete: true, morning_complete: true, afternoon_complete: true },
    "2026-07-27": { day_complete: true, morning_complete: true, afternoon_complete: true },
    "2026-07-28": { morning_complete: true },
  });
  const r = creditSit(d, "afternoon", "2026-07-28", at(16));
  check("no milestone at 3", r.milestone, null);
}

// gap breaks streak
{
  const d = dataWith({
    "2026-07-25": { day_complete: true, morning_complete: true, afternoon_complete: true },
    "2026-07-27": { day_complete: true, morning_complete: true, afternoon_complete: true },
  });
  check("gap: only yesterday counts", computeStreak(d, "2026-07-28"), 1);
  check("today incomplete, yesterday missed -> 0", computeStreak(dataWith({ "2026-07-26": { day_complete: true, morning_complete: true, afternoon_complete: true } }), "2026-07-28"), 0);
}

// manual day credit bridges a gap
{
  let d = dataWith({
    "2026-07-25": { day_complete: true, morning_complete: true, afternoon_complete: true },
    "2026-07-27": { day_complete: true, morning_complete: true, afternoon_complete: true },
  });
  d = creditDayManually(d, "2026-07-26");
  check("manual credit bridges gap", computeStreak(d, "2026-07-28"), 3);
  check("manually_credited flag", d.days["2026-07-26"].manually_credited, true);
}

// anchor: parent sets streak
{
  let d = dataWith({});
  d = setStreakManually(d, 10, at(12));
  check("anchor set to yesterday", d.meta.anchor, { date: "2026-07-27", value: 10 });
  check("streak reads 10", computeStreak(d, "2026-07-28"), 10);
  // completing today extends it
  d.days["2026-07-28"] = {
    date: "2026-07-28",
    morning_complete: true,
    afternoon_complete: true,
    day_complete: true,
    manually_credited: false,
  };
  check("anchor + today = 11", computeStreak(d, "2026-07-28"), 11);
  // a later gap invalidates the anchor
  check("gap after anchor -> derived only", computeStreak(d, "2026-07-30"), 0);
}

if (failures > 0) {
  console.error(`\n${failures} failure(s)`);
  process.exit(1);
}
console.log("\nall checks passed");
