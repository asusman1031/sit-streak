# Sit Streak (placeholder name — Sawyer names it)

A single-purpose PWA: two 5-minute sits per day, one screen, a streak, and a
disproportionately good celebration. Built to spec v1.

## What's here

- **One screen**, state-driven: sit available → timer → sit done / day complete →
  locked / done-for-today. No navigation.
- **Timestamp-based timer**: remaining time always derives from the stored start
  timestamp and `Date.now()`. Close the app, lock the screen, come back — it's
  right. Reopening past 5:00 completes the sit. Screen wake lock while running.
- **Windows**: morning sit before 9:00 AM, afternoon after 3:00 PM
  (parent-adjustable). Timezone `America/New_York`, day rolls over at 4:00 AM.
- **Streak**: both sits = day complete = +1, at the moment the second sit ends.
  Milestone badges at 3/7/14/30/60 with a bigger gold celebration. Broken streak
  shows a neutral "Start a new streak" — no shame copy anywhere.
- **Celebrations**: 4 rotating confetti variants (rain, starburst, emoji rain,
  fireworks), synthesized fanfares (WebAudio, no assets), count-up streak
  number, tap to dismiss.
- **Parent panel** (hidden: long-press the streak number, or 5 rapid taps on the
  top-right corner): credit a day, set the streak, adjust window times,
  parent-only output log, JSON/CSV export, restore-from-backup.
- **Persistence**: `localStorage`, plus a timestamped backup key written on
  every save (last 12 kept). Corrupt/missing primary auto-recovers from backup.
- **Offline**: service worker (network-first shell, cache-first assets); zero
  runtime dependencies beyond Next/React.

## Commands

```bash
npm run dev      # local dev
npm run build    # production build
npm run sanity   # logic checks: rollover, DST, windows, streaks, double-credit guard
npm run icons    # regenerate PWA icons (scripts/gen-icons.mjs)
```

## Before shipping to Sawyer

1. Let him pick the **name** and **theme** — swap `metadata`/`manifest` names and
   the CSS tokens at the top of `app/globals.css`, then `npm run icons`.
2. Deploy to Vercel, open on his phone, **Add to Home Screen**.
3. Decide milestone rewards with him so the 3-day badge already means something.

## v2 (planned)

- Supabase sync: single table, device-scoped id, no auth.
