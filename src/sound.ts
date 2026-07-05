/**
 * sound — LEXICON's procedural Web Audio SFX manager (standalone singleton).
 *
 * ── DESIGN ──────────────────────────────────────────────────────────────────
 * Every sound here is SYNTHESIZED at play time from oscillators + gain
 * envelopes — there are no audio asset files, no samples, zero download cost.
 * The palette is deliberately warm and clean (soft sine/triangle cores, short
 * exponential release ramps) to suit a cosy word game: nothing chiptune, nothing
 * harsh. It borrows the procedural-synth approach CHIMERA uses (oscillator +
 * ADSR-ish gain, no assets) but is fully self-contained — no imports from
 * chimera or game-kit, just the platform Web Audio API.
 *
 * ── ARCHITECTURE ────────────────────────────────────────────────────────────
 * ONE lazily-created AudioContext feeds ONE master GainNode; everything routes
 * through that master (so mute is a single gain flip and levels stay sane when
 * sounds overlap). Each "voice" is a throwaway OscillatorNode + GainNode: it is
 * scheduled entirely on the audio clock (start/stop with absolute times), and an
 * `onended` handler disconnects both nodes so nothing leaks. Methods return
 * immediately — they only *schedule* work, they never block.
 *
 * Per-sound gains are kept low (well under 1.0) and envelopes are short, so
 * rapid-fire calls (e.g. `tap()` during a drag) don't pile up into clipping.
 *
 * ── SAFETY ──────────────────────────────────────────────────────────────────
 * SSR / no-AudioContext safe: we guard `typeof window` and the presence of an
 * AudioContext constructor. Browser autoplay policy leaves a fresh context
 * SUSPENDED until a user gesture, so `unlock()` (called on the first gesture)
 * resumes it. Every play* method is a graceful no-op — never throws — when audio
 * is unavailable, muted, or the context hasn't been unlocked yet.
 *
 * ── MUTE PERSISTENCE ────────────────────────────────────────────────────────
 * The mute choice persists to localStorage under "lexicon:muted" and is read
 * back on init, so the toggle survives reloads. localStorage access is wrapped
 * in try/catch (private-mode / SSR safe).
 */

import { getMuted as storeGetMuted, setMuted as storeSetMuted } from "./store.js";

/** The subset of AudioContext the browser exposes (incl. webkit-prefixed). */
type Ctor = typeof AudioContext;

/** Resolve an AudioContext constructor if one exists in this environment. */
function getAudioContextCtor(): Ctor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    AudioContext?: Ctor;
    webkitAudioContext?: Ctor;
  };
  return w.AudioContext ?? w.webkitAudioContext ?? null;
}

/** Read the persisted mute flag (via the kit-settings-backed store). */
function readMuted(): boolean {
  return storeGetMuted();
}

/** Persist the mute flag (via the store). */
function writeMuted(muted: boolean): void {
  try {
    storeSetMuted(muted);
  } catch {
    // The in-memory flag still works even if persistence fails.
  }
}

/** Shape of one scheduled tone voice. */
interface ToneOpts {
  /** Oscillator waveform — sine/triangle read "warm", square/saw read "harsh". */
  wave?: OscillatorType;
  /** Frequency in Hz. May be a fixed value or a [from, to] glide. */
  freq: number | [number, number];
  /** Peak gain of this voice (kept low so overlaps don't clip). */
  gain: number;
  /** Seconds from `now` before the note starts. */
  delay?: number;
  /** Attack time in seconds (fade-in) — short by default to avoid clicks. */
  attack?: number;
  /** Total audible duration in seconds (attack + hold + release). */
  duration: number;
}

class SoundManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  /** True once we've decided the environment can never produce audio. */
  private unavailable = false;

  constructor() {
    // Read the persisted preference eagerly so isMuted() is correct pre-unlock.
    this.muted = readMuted();
  }

  /**
   * Resume/create the AudioContext. Call on the first user gesture. Safe to call
   * repeatedly — a no-op once the context is running. Never throws.
   */
  unlock(): void {
    if (this.unavailable) return;
    try {
      if (!this.ctx) {
        const Ctor = getAudioContextCtor();
        if (!Ctor) {
          this.unavailable = true;
          return;
        }
        this.ctx = new Ctor();
        this.master = this.ctx.createGain();
        // A gentle master ceiling so the sum of overlapping voices stays clean.
        this.master.gain.value = 0.9;
        this.master.connect(this.ctx.destination);
      }
      // A fresh context is "suspended" under autoplay policy — resume it. The
      // promise is intentionally not awaited; callers want an instant return.
      if (this.ctx.state === "suspended") void this.ctx.resume();
    } catch {
      // Construction/resume blocked — mark unavailable so we stop retrying.
      this.unavailable = true;
    }
  }

  /** Set the mute state and persist it. When muted, all play* calls no-op. */
  setMuted(m: boolean): void {
    this.muted = m;
    writeMuted(m);
  }

  /** Whether sound is currently muted. */
  isMuted(): boolean {
    return this.muted;
  }

  /**
   * Whether we can actually schedule audio right now: a running, unlocked
   * context and not muted. Gates every play* method.
   */
  private ready(): boolean {
    return (
      !this.muted &&
      !this.unavailable &&
      this.ctx !== null &&
      this.master !== null &&
      this.ctx.state === "running"
    );
  }

  /**
   * Schedule one throwaway oscillator voice through a per-voice gain envelope.
   * The envelope is attack → exponential release; `onended` disconnects both
   * nodes so nothing leaks. All timing rides the audio clock.
   */
  private tone(opts: ToneOpts): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const now = ctx.currentTime + (opts.delay ?? 0);
    const attack = opts.attack ?? 0.006;
    const dur = opts.duration;
    const peak = opts.gain;

    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = opts.wave ?? "sine";

    // Frequency: fixed, or a glide from → to across the note's life.
    if (Array.isArray(opts.freq)) {
      const [from, to] = opts.freq;
      osc.frequency.setValueAtTime(from, now);
      // exponentialRamp needs strictly-positive targets; freqs always are.
      osc.frequency.exponentialRampToValueAtTime(to, now + dur);
    } else {
      osc.frequency.setValueAtTime(opts.freq, now);
    }

    // Gain envelope: start at ~0, ramp up (attack), then exponentially decay to
    // near-silence by the end. Exponential release reads as a natural "bloom".
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(peak, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    osc.connect(g);
    g.connect(master);

    osc.onended = () => {
      try {
        osc.disconnect();
        g.disconnect();
      } catch {
        // Already torn down — nothing to do.
      }
    };

    osc.start(now);
    // A hair of tail beyond the envelope so the release fully rings out.
    osc.stop(now + dur + 0.02);
  }

  // ── PUBLIC SOUND PALETTE ───────────────────────────────────────────────────

  /**
   * tap — a very short, soft tick: a tile joining the trace. Cheap and subtle
   * (played rapidly during a drag), so it's a single high-ish blip at low gain
   * with a tiny envelope that won't pile up.
   */
  tap(): void {
    if (!this.ready()) return;
    this.tone({ wave: "triangle", freq: 660, gain: 0.06, attack: 0.002, duration: 0.05 });
  }

  /**
   * found — the reward chime for a valid word. This is the "money" sound: a warm
   * two/three-note bloom that rises with the word's point value. `points`
   * (roughly 1..11) maps to an ascending root pitch, and higher scores add a
   * bright octave sparkle so a big find feels genuinely bigger.
   */
  found(points: number): void {
    if (!this.ready()) return;

    // Clamp to the expected 1..11 range, then map to a pentatonic-ish ascent so
    // consecutive point values still land on pleasant, in-key steps.
    const p = Math.max(1, Math.min(11, Math.round(points)));
    // A warm C-major pentatonic ladder (C4..C6-ish), indexed by points.
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24];
    const semis = scale[Math.min(scale.length - 1, p - 1)];
    const root = 392.0 * Math.pow(2, semis / 12); // base G4, climbing.

    // Root note + a fifth above, arpeggiated slightly for a chime-like sparkle.
    this.tone({ wave: "triangle", freq: root, gain: 0.16, attack: 0.004, duration: 0.34 });
    this.tone({
      wave: "sine",
      freq: root * 1.5,
      gain: 0.1,
      delay: 0.05,
      attack: 0.004,
      duration: 0.3,
    });
    // Bigger words earn a shimmering octave on top — the "brighter for more".
    if (p >= 5) {
      this.tone({
        wave: "sine",
        freq: root * 2,
        gain: 0.07,
        delay: 0.1,
        attack: 0.004,
        duration: 0.26,
      });
    }
  }

  /**
   * invalid — a soft, non-harsh "no" for a rejected/dead-end word. A short,
   * low, downward triangle blip (a muted thud, not a buzzer) so it corrects
   * gently without punishing the ear.
   */
  invalid(): void {
    if (!this.ready()) return;
    this.tone({ wave: "triangle", freq: [180, 120], gain: 0.11, attack: 0.004, duration: 0.18 });
  }

  /**
   * tick — a quiet clock tick for the final ~10 seconds of a timed round. Very
   * short and low-gain so it's a background pulse, not a nag.
   */
  tick(): void {
    if (!this.ready()) return;
    this.tone({ wave: "sine", freq: 880, gain: 0.05, attack: 0.001, duration: 0.04 });
  }

  /**
   * timeUp — a gentle round-over tone. A soft descending two-note fall (not an
   * alarm): "that's time" said kindly.
   */
  timeUp(): void {
    if (!this.ready()) return;
    this.tone({ wave: "sine", freq: 523.25, gain: 0.12, attack: 0.006, duration: 0.32 });
    this.tone({
      wave: "sine",
      freq: 392.0,
      gain: 0.12,
      delay: 0.16,
      attack: 0.006,
      duration: 0.4,
    });
  }

  /**
   * begin — a soft rising flourish when a round starts. A quick two-note lift
   * (root → fifth) with a gentle attack: "here we go".
   */
  begin(): void {
    if (!this.ready()) return;
    this.tone({ wave: "triangle", freq: 329.63, gain: 0.11, attack: 0.008, duration: 0.2 });
    this.tone({
      wave: "triangle",
      freq: 493.88,
      gain: 0.12,
      delay: 0.11,
      attack: 0.008,
      duration: 0.3,
    });
    // A quiet octave sparkle on top to make the lift feel bright, not flat.
    this.tone({
      wave: "sine",
      freq: 659.25,
      gain: 0.06,
      delay: 0.18,
      attack: 0.006,
      duration: 0.28,
    });
  }

  /**
   * levelClear — a smooth, calm chime for beating a board: a gentle rising major
   * arpeggio (C–E–G–C) on soft sines with a slow release, over a warm low root.
   * Reassuring and resolved, never loud.
   */
  levelClear(): void {
    if (!this.ready()) return;
    const notes = [523.25, 659.25, 783.99, 1046.5]; // C5 E5 G5 C6
    notes.forEach((f, i) =>
      this.tone({ wave: "sine", freq: f, gain: 0.1, delay: i * 0.12, attack: 0.01, duration: 0.6 }),
    );
    this.tone({ wave: "triangle", freq: 261.63, gain: 0.06, attack: 0.02, duration: 0.95 });
  }
}

/** The shared singleton — import and call anywhere; safe before `unlock()`. */
export const sound = new SoundManager();
