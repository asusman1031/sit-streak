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

/** Toilet flush for the timer-done poop finale: filtered noise sweep + glugs. */
export function playFlush(): void {
  ensureAudio();
  if (!ctx) return;
  const t0 = ctx.currentTime;
  const dur = 1.4;
  const len = Math.floor(ctx.sampleRate * dur);
  const buf = ctx.createBuffer(1, len, ctx.sampleRate);
  const ch = buf.getChannelData(0);
  for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  const filter = ctx.createBiquadFilter();
  filter.type = "lowpass";
  filter.Q.value = 2;
  filter.frequency.setValueAtTime(1500, t0);
  filter.frequency.exponentialRampToValueAtTime(180, t0 + dur);
  const gain = ctx.createGain();
  gain.gain.setValueAtTime(0.0001, t0);
  gain.gain.exponentialRampToValueAtTime(0.45, t0 + 0.08);
  gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
  src.connect(filter).connect(gain).connect(ctx.destination);
  src.start(t0);
  src.stop(t0 + dur);
  // descending glugs as it goes down the drain
  note(320, 0.45, 0.12, "sine", 0.22);
  note(250, 0.7, 0.12, "sine", 0.22);
  note(190, 0.95, 0.16, "sine", 0.22);
  vibrate([80, 60, 250]);
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

/** Milestone — a deep explosion boom, then the big fanfare. */
export function playMilestone(): void {
  ensureAudio();
  if (ctx) {
    // the boom: a burst of lowpassed noise sweeping down, like a blast
    const t0 = ctx.currentTime;
    const dur = 0.9;
    const len = Math.floor(ctx.sampleRate * dur);
    const buf = ctx.createBuffer(1, len, ctx.sampleRate);
    const ch = buf.getChannelData(0);
    for (let i = 0; i < len; i++) ch[i] = Math.random() * 2 - 1;
    const src = ctx.createBufferSource();
    src.buffer = buf;
    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(700, t0);
    filter.frequency.exponentialRampToValueAtTime(60, t0 + dur);
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(0.6, t0 + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    src.connect(filter).connect(gain).connect(ctx.destination);
    src.start(t0);
    src.stop(t0 + dur);
  }
  const off = 0.6; // fanfare rides in after the blast
  const seq: [number, number, number][] = [
    [523, 0, 0.16], [659, 0.14, 0.16], [784, 0.28, 0.16], [1047, 0.42, 0.3],
    [784, 0.7, 0.14], [1047, 0.84, 0.14], [1319, 0.98, 0.3],
    [1047, 1.3, 0.15], [1319, 1.45, 0.15], [1568, 1.6, 0.8],
  ];
  for (const [f, s, d] of seq) note(f, s + off, d, "triangle", 0.3);
  vibrate([400, 80, 150, 75, 150, 75, 500]);
}
