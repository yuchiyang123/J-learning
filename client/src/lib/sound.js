// Tiny WebAudio synth — every sound the site makes is generated here, no
// audio files. A 風鈴 (wind chime) for hovering lanterns, a koto pluck for
// presses, a taiko thump for passing through a gate, a sliding-wood hush
// for the shoji doors. The AudioContext is created lazily on the first
// user gesture (browsers keep it suspended before one) and the whole thing
// can be muted from the lantern toolbar; the choice is remembered.

const KEY = 'jp_sound';
let ctx = null;
let master = null;
let enabled = (() => {
  try { return localStorage.getItem(KEY) !== 'off'; } catch { return true; }
})();
const listeners = new Set();

function ac() {
  if (!ctx) {
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return null;
    ctx = new AC();
    master = ctx.createGain();
    master.gain.value = 0.9;
    master.connect(ctx.destination);
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {});
  return ctx;
}

// Warm the context up on the first real gesture so later hover sounds
// (which aren't user activations themselves) are allowed to play.
if (typeof window !== 'undefined') {
  const warm = () => { ac(); window.removeEventListener('pointerdown', warm); window.removeEventListener('keydown', warm); };
  window.addEventListener('pointerdown', warm, { passive: true });
  window.addEventListener('keydown', warm);
}

export function isSoundEnabled() { return enabled; }
export function setSoundEnabled(v) {
  enabled = Boolean(v);
  try { localStorage.setItem(KEY, enabled ? 'on' : 'off'); } catch { /* fine */ }
  listeners.forEach((fn) => fn(enabled));
  if (enabled) ac();
}
export function onSoundChange(fn) { listeners.add(fn); return () => listeners.delete(fn); }

function tone({ type = 'sine', freq = 880, gain = 0.1, attack = 0.005, decay = 0.8, detune = 0, when = 0 }) {
  const c = ac();
  if (!c || !enabled || c.state !== 'running') return;
  const t0 = c.currentTime + when;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (detune) osc.detune.setValueAtTime(detune, t0);
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + attack);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + attack + decay + 0.05);
}

// 風鈴 — a glassy high partial pair, long decay.
export function chime(pitch = 0) {
  const base = [1760, 1976, 2093, 2349, 2637][Math.abs(pitch) % 5];
  tone({ freq: base, gain: 0.05, decay: 1.3 });
  tone({ freq: base * 2.76, gain: 0.018, decay: 0.7, detune: 8 });
}

// Koto — a plucked string: bright attack that darkens quickly.
export function pluck(step = 0) {
  const scale = [293.66, 329.63, 349.23, 440, 466.16, 587.33]; // 平調子-ish
  const f = scale[Math.abs(step) % scale.length];
  tone({ type: 'triangle', freq: f, gain: 0.12, decay: 0.55 });
  tone({ type: 'sine', freq: f * 2, gain: 0.05, decay: 0.25 });
  tone({ type: 'sine', freq: f * 3.01, gain: 0.02, decay: 0.15 });
}

// 太鼓 — a pitch-dropping thump plus a short breath of noise.
export function thump() {
  const c = ac();
  if (!c || !enabled || c.state !== 'running') return;
  const t0 = c.currentTime;
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(110, t0);
  osc.frequency.exponentialRampToValueAtTime(42, t0 + 0.28);
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(0.5, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42);
  osc.connect(g).connect(master);
  osc.start(t0);
  osc.stop(t0 + 0.5);
  noise(0.09, 0.12, 900);
}

// Sliding wood (shoji) — filtered noise that swells and stops.
export function slide() {
  noise(0.35, 0.06, 1400);
}

function noise(duration, gain, cutoff) {
  const c = ac();
  if (!c || !enabled || c.state !== 'running') return;
  const len = Math.floor(c.sampleRate * duration);
  const buf = c.createBuffer(1, len, c.sampleRate);
  const data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource();
  src.buffer = buf;
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.frequency.value = cutoff;
  const g = c.createGain();
  const t0 = c.currentTime;
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + duration * 0.3);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(f).connect(g).connect(master);
  src.start(t0);
}
