// All audio is synthesized with WebAudio so the app has zero asset
// dependencies and works fully offline. Best-effort: if the context is
// blocked (no user gesture yet), we fail silently and vibration covers it.

let ctx: AudioContext | null = null;

export function ensureAudio(): void {
  try {
    if (!ctx) {
      const AC =
        window.AudioContext ??
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (AC) ctx = new AC();
    }
    if (ctx?.state === "suspended") void ctx.resume();
  } catch {
    ctx = null;
  }
}

function note(
  freq: number,
  startIn: number,
  duration: number,
  type: OscillatorType = "sine",
  gainPeak = 0.25
): void {
  if (!ctx) return;
  const t0 = ctx.currentTime + startIn;
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(gainPeak, t0 + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(gain).connect(ctx.destination);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    // unsupported, fine
  }
}

/** Timer hit 0:00 — clear, happy "done" chime. He may not be looking. */
export function playTimerDone(): void {
  ensureAudio();
  note(660, 0, 0.35, "triangle", 0.3);
  note(880, 0.15, 0.4, "triangle", 0.3);
  note(1320, 0.3, 0.6, "triangle", 0.25);
  vibrate([200, 100, 200, 100, 400]);
}

/** First sit of the day done — short positive blip. */
export function playSitDone(): void {
  ensureAudio();
  note(523, 0, 0.2, "triangle", 0.25);
  note(784, 0.12, 0.35, "triangle", 0.25);
  vibrate(150);
}

/** Day complete — celebration fanfares, one per rotating variant. */
export function playCelebration(variant: number): void {
  ensureAudio();
  const fanfares: number[][][] = [
    // [freq, startIn, duration]
    [[523, 0, 0.18], [659, 0.14, 0.18], [784, 0.28, 0.18], [1047, 0.42, 0.5]],
    [[392, 0, 0.15], [523, 0.1, 0.15], [659, 0.2, 0.15], [784, 0.3, 0.2], [1047, 0.45, 0.55]],
    [[659, 0, 0.12], [659, 0.14, 0.12], [784, 0.28, 0.2], [988, 0.44, 0.5]],
    [[523, 0, 0.14], [784, 0.12, 0.14], [1047, 0.24, 0.2], [1319, 0.4, 0.55]],
  ];
  const seq = fanfares[variant % fanfares.length];
  for (const [f, s, d] of seq) note(f, s, d, "triangle", 0.3);
  vibrate([100, 50, 100, 50, 300]);
}

/** Milestone — longer, bigger fanfare. */
export function playMilestone(): void {
  ensureAudio();
  const seq: [number, number, number][] = [
    [523, 0, 0.16], [659, 0.14, 0.16], [784, 0.28, 0.16], [1047, 0.42, 0.3],
    [784, 0.7, 0.14], [1047, 0.84, 0.14], [1319, 0.98, 0.3],
    [1047, 1.3, 0.15], [1319, 1.45, 0.15], [1568, 1.6, 0.8],
  ];
  for (const [f, s, d] of seq) note(f, s, d, "triangle", 0.3);
  vibrate([150, 75, 150, 75, 150, 75, 500]);
}
