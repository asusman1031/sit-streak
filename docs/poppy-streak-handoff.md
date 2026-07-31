# Handoff: bring poppy-streak up to StreakPrize feature parity

For the agent working on poppy-streak (Ashton's app). StreakPrize (Sawyer's
app) lives on `main` of this repo — port from it rather than reinventing.
Keep poppy-streak's own theme, name, celebrations, and copy voice; this doc
covers mechanics, not looks. Where Ashton's preferences differ (durations,
sounds, notation), his choices win.

## Non-negotiable design principles (carry these over exactly)

1. The streak counts **sits, not results**. Nothing about accidents or output
   in any child-facing copy, icon, or celebration.
2. The timer is the authority, not the parent. Child starts it, timer ends it.
3. Never punish or shame. A broken streak shows a neutral "Start a new
   streak" — no sad faces, no "you lost it."
4. One screen, nothing to navigate. Parent features hide behind gestures.
5. Cancelling a sit has no penalty and no negative copy (log it with
   `completed: false` for the export).

## Feature 1: Bonus sits (port from `lib/logic.ts`, `lib/types.ts` on main)

- Third window type `'bonus'` alongside morning/afternoon. Available any
  time, **once per day**, never required, never substitutes for the two
  regular sits.
- Bonus duration is **half the regular sit** (StreakPrize: 10:00 regular,
  5:00 bonus). See `durationFor(window)` in `lib/types.ts`.
- A completed day with a bonus is worth **1.5 days**; streaks are fractional.
  Display decimals ("2.5"), not fractions ("2 ½") — kid-tested preference.
  StreakPrize renders a small gold star next to fractional streak numbers.
- `DayRec` gains optional `bonus_complete?: boolean`. Old saved data lacks
  the field — treat missing as false everywhere (`Boolean(day.bonus_complete)`).
- **Milestone logic must change to threshold-crossing**, not equality:
  `prev < m && new >= m` for each milestone not yet earned. With half-day
  jumps, equality checks skip milestones (9.5 → 11 must still earn 10).
- Streak walk (see `computeStreak`): consecutive complete days ending today
  (if complete) or yesterday; each day contributes `1.5` if bonus else `1`.
  A bonus on an *incomplete* day contributes nothing until the day completes.
- UI: a small third slot (star) next to the two sit slots; a secondary
  button under the main action ("⭐ Bonus sit · 5 min · +0.5"); distinct
  bonus copy on the timer and the completion overlay. A bonus that crosses
  a milestone triggers the full milestone celebration.

## Feature 2: Cross-device sync + family login (port `lib/sync.ts`, `components/LoginScreen.tsx`)

**Reuse the existing backend — do not create new infrastructure.** The
Supabase project `zwiqmrlquldhjjwbeakj` (kidsync) already has:

- Table `public.streakprize_sync (sync_id text pk, data jsonb, updated_at)` —
  RLS-locked, no direct access, so rows can't be enumerated.
- RPCs `streakprize_get(p_sync_id)` and `streakprize_put(p_sync_id, p_data)`
  (SECURITY DEFINER, granted to anon). `p_sync_id` must be ≥16 chars;
  payload capped at 1 MB.
- REST endpoint: `https://zwiqmrlquldhjjwbeakj.supabase.co/rest/v1/rpc/<fn>`
  with headers `apikey` / `Authorization: Bearer` set to the publishable key
  (already in `lib/sync.ts` on main; it's public by design).

Poppy-streak simply uses its **own family password → its own row**. The id
namespace keeps families fully separate. Generic table name notwithstanding,
it's a shared key-value store.

Architecture (all in `lib/sync.ts` on main — copy it nearly verbatim):

- **Local-first**: localStorage is the source of truth; the cloud is
  catch-up. Offline is a normal state, never an error.
- **Identity = family password**, typed once per device. The row id derives
  from it: `"fam-" + sha256("streakprize-family-v1:" + normalized)` where
  normalized = trim, lowercase, collapse whitespace. **Change the derivation
  prefix for poppy** (e.g. `"poppystreak-family-v1:"`) so the same password
  on both apps can never collide.
- **No auto-generated device ids.** An un-identified device renders a login
  screen and nothing else. This is the load-bearing decision: auto-created
  silos caused four forked records in three days on StreakPrize.
- Login flow: derive id → `streakprize_get`. Row exists → adopt id, merge
  local into remote, push. Row missing → say "no family found with that
  password" and require an explicit **Create new family** tap. Never
  silently create on a typo.
- **Merge semantics** (`mergeData`): completions union per day (OR each
  flag — a credited sit can never be lost by a merge), sits and output-log
  union by id, milestones union, longest = max, scalars (settings, anchor,
  active timer) from the copy with newer `updatedAt`, then **recompute the
  streak from the merged days**. `AppData.updatedAt` is stamped on every save.
- Sync cadence: pull+merge on load, on visibilitychange→visible, every 60s
  while visible; push debounced ~1.5s after every commit.
- Join links: `/?join=<id>` adopts an id and counts as login;
  `&fresh=1` wipes local state first (clean re-point of a stale device).
  Validate and normalize any id/password input on every entry path.

## Feature 3: Parent panel (port `components/ParentPanel.tsx`)

Hidden: long-press the streak number (~900ms) or 5 rapid taps in the
top-right corner. Contents worth parity:

- **Credit a day** (date picker → marks the day complete,
  `manually_credited: true`). Essential for travel/illness.
- **Adjust streak** via anchor semantics: store `{date, value}` meaning "as
  of end of `date`, streak was `value`"; the streak walk stops there and
  adds it, and any later gap invalidates it naturally. Don't mutate day
  records to fake a streak.
- Adjustable window times; toggle for the timer-finish animation.
- Parent-only output log (never surfaced in child UI) + JSON/CSV export.
- Restore-from-backup (localStorage backup key written on every save,
  last 12 kept, auto-recovery if the primary is corrupt — see `lib/storage.ts`).
- Log out of family (clears identity, back to login screen).

## Gotchas that cost us real debugging time

- **iOS installed PWAs have separate storage from Safari.** A join/login in
  the browser does not carry into the Add-to-Home-Screen app. Expected flow:
  install first, open the installed app, log in there (once).
- **No pull-to-refresh in installed PWAs.** Ship a service worker that's
  network-first for navigations (cache fallback) and cache-first only for
  hashed assets — then "fully quit and relaunch" always picks up new builds.
  Bump the SW cache name when icons/assets change.
- **Timer must derive from the start timestamp**, never a ticking counter:
  store `startedAt`, compute remaining on every render/visibility change;
  reopening past the end completes the sit retroactively. Keep a screen
  wake lock while running; reacquire on visibilitychange.
- **Stable callbacks for overlay auto-dismiss timers.** If the dismiss
  callback is recreated on every render (the app re-renders every second on
  the clock tick), the auto-dismiss timeout resets forever and the overlay
  never closes. Wrap in `useCallback` with stable deps.
- Windows/day math: local timezone with a 4 AM rollover; a "day key" is the
  calendar date as of 4 hours ago. After-midnight sits belong to the prior
  day. DST-safe epoch construction is in `lib/time.ts` (`nyEpoch`) — port it.
- Guard double-crediting a window on the same day at the credit function,
  not the UI.

## Test checklist (StreakPrize keeps these in `scripts/sanity.ts` — port and adapt)

Day rollover at 4 AM (both EST and EDT); after-midnight sits credit the
prior day; window state at 7am/10am/4pm; double-credit guard; streak breaks
on a gap; manual credit bridges a gap; anchor set/extend/invalidate; bonus
half-day math (complete vs incomplete day, double-bonus guard, duration);
milestone threshold-crossing (including a fractional jump over 10); merge:
union of windows across devices, never-lose-a-credited-day, newer-settings-
win, milestone union.

## Coordination notes

- Aron holds each family's password; don't print or log them.
- If you need schema changes to the shared table, don't — add a new table
  instead; StreakPrize is live on this one.
- StreakPrize reference implementation: `main` branch — `lib/` (types,
  time, logic, storage, sync, sound, confetti) and `components/` (App,
  MainScreen, TimerScreen, FlushOverlay, Celebration, SitDoneOverlay,
  LoginScreen, ParentPanel). History from `8cd210a` onward tells the story,
  commit by commit.
