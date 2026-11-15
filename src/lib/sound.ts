/**
 * Small interface sounds, synthesised with Web Audio (no files to download). Quiet, short and optional:
 * one switch turns them all off (Settings > Accessibility, or the speaker button beside a control that uses them),
 * remembered on this device. Nothing plays before the person has interacted with the page (browsers require that).
 * A sound never carries meaning on its own: everything it marks is also shown.
 */
const KEY = "w360.sounds";
type Listener = (on: boolean) => void;
const listeners = new Set<Listener>();
let ctx: AudioContext | null = null;
let lastTick = 0;

export function soundsOn(): boolean {
  try {
    return localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundsOn(on: boolean) {
  try {
    localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    /* private mode: the choice lasts for this visit only */
  }
  listeners.forEach((l) => l(on));
}

export function onSoundsChange(l: Listener): () => void {
  listeners.add(l);
  return () => listeners.delete(l);
}

function audio(): AudioContext | null {
  if (!soundsOn() || typeof window === "undefined") return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  try {
    ctx ??= new Ctor();
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

/** One short tone: frequency glide, a quick attack and a soft exponential release. */
function tone(freq: number, { to = freq, ms = 60, gain = 0.05, type = "sine" as OscillatorType, delay = 0 } = {}) {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay / 1000;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + ms / 1000);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.004);
  g.gain.exponentialRampToValueAtTime(0.0001, t + ms / 1000);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + ms / 1000 + 0.02);
}

/** A detent passing: the click of a wheel. Rate-limited so a fast spin stays a purr, not a buzz. */
export function playTick() {
  const now = performance.now();
  if (now - lastTick < 28) return;
  lastTick = now;
  tone(1900, { to: 1200, ms: 18, gain: 0.035, type: "triangle" });
  try {
    navigator.vibrate?.(4);
  } catch {
    /* not supported */
  }
}

/** A key going down. Pitch varies a little so typing doesn't sound mechanical. */
export function playKey() {
  tone(520 + Math.random() * 120, { to: 380, ms: 24, gain: 0.025, type: "triangle" });
}

export function playReveal() {
  tone(420, { to: 880, ms: 140, gain: 0.03 });
}

export function playHide() {
  tone(880, { to: 420, ms: 120, gain: 0.03 });
}

/** A step up the strength meter. */
export function playLevel(level: number) {
  tone(440 * 2 ** (level / 6), { ms: 90, gain: 0.03 });
}

export function playSuccess() {
  tone(660, { ms: 90, gain: 0.04 });
  tone(990, { ms: 140, gain: 0.04, delay: 80 });
}

export function playError() {
  tone(220, { to: 160, ms: 160, gain: 0.04, type: "triangle" });
}

/** A shimmer for a generated suggestion. */
export function playSparkle() {
  [880, 1175, 1568].forEach((f, i) => tone(f, { ms: 90, gain: 0.025, delay: i * 45 }));
}
