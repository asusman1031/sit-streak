# Poppy Streaks (Ashton's app)

Ashton's own version of the family sit-streak PWA (Sawyer's lives at
streak-prize.vercel.app — this is a separate app on a separate deploy, with
its own streak and its own look). Two 5-minute sits per day, one screen, a
streak, and a disproportionately good celebration.

## What's here

- **One screen**, state-driven: sit available → timer → sit done / day complete →
  locked / done-for-today. No navigation.
- **Timestamp-based timer**: remaining time always derives from the stored start
  timestamp and `Date.now()`. Close the app, lock the screen, come back — it's
  right. Reopening past 5:00 completes the sit. Screen wake lock while running.
- **Windows**: morning sit before 9:00 AM, afternoon after 3:00 PM
  (parent-adjustable). Timezone `America/New_York`, day rolls over at 4:00 AM.
- **Streak**: both sits = day complete = +1, at the moment the second sit ends.
  Milestone badges every 10 days with a longer gold fireworks celebration.
  Broken streak shows a neutral "Start a new streak" — no shame copy anywhere.
- **Timer finish**: dancing 💩 that flushes away with a synthesized flush sound
  and swirl-out (parent-panel toggle to disable).
- **Celebrations**: confetti on every completed day, gold fireworks on 10-day
  milestones, synthesized fanfares (WebAudio, no assets), count-up streak
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

## Branding

Ashton's Poppy Streaks logo: a poop emoji with star eyes and a diamond mouth,
on a poppy-red gradient. SVG sources in `assets/`, rendered PNGs in `public/`
(home-screen icons) and `app/icon.png` (favicon). The maskable icon
(`public/icon-512-maskable.png`) is the full-bleed variant of
`assets/icon.svg` (rx=0). Regenerate with `npm run icons`.

## Before shipping to Ashton

1. Open the live URL on his phone, **Add to Home Screen**.
2. Decide milestone rewards with him so the first 10-day badge already means
   something.

## v2 (planned)

- Supabase sync: single table, device-scoped id, no auth.
