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
  /** Lazily-built white-noise buffer, reused for the filtered wooden clacks. */
  private noiseBuf: AudioBuffer | null = null;

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

  /** Shared white-noise buffer (built once) — the raw material for clacks. */
  private getNoise(ctx: AudioContext): AudioBuffer {
    if (!this.noiseBuf) {
      const len = Math.floor(ctx.sampleRate * 0.4);
      const buf = ctx.createBuffer(1, len, ctx.sampleRate);
      const data = buf.getChannelData(0);
      for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
      this.noiseBuf = buf;
    }
    return this.noiseBuf;
  }

  /**
   * A short burst of BAND/LOW-pass filtered noise — the organic, tactile layer
   * (wooden tile-clacks, soft thuds). Same throwaway-node discipline as tone().
   */
  private noise(opts: {
    type?: BiquadFilterType;
    freq: number;
    q?: number;
    gain: number;
    delay?: number;
    attack?: number;
    duration: number;
  }): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;
    const now = ctx.currentTime + (opts.delay ?? 0);
    const dur = opts.duration;
    const attack = opts.attack ?? 0.001;

    const src = ctx.createBufferSource();
    src.buffer = this.getNoise(ctx);
    const filt = ctx.createBiquadFilter();
    filt.type = opts.type ?? "bandpass";
    filt.frequency.value = opts.freq;
    filt.Q.value = opts.q ?? 1;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.linearRampToValueAtTime(opts.gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);

    src.connect(filt);
    filt.connect(g);
    g.connect(master);
    src.onended = () => {
      try {
        src.disconnect();
        filt.disconnect();
        g.disconnect();
      } catch {
        /* already torn down */
      }
    };
    src.start(now);
    src.stop(now + dur + 0.02);
  }

  /**
   * A woody MARIMBA/kalimba note: the fundamental plus a bright 4th harmonic (the
   * marimba's signature) and a soft body octave, all with a quick pluck decay.
   * The warm, tactile core of the "cozy scholar" palette.
   */
  private marimba(freq: number, gain: number, delay = 0, dur = 0.42): void {
    this.tone({ wave: "sine", freq, gain, delay, attack: 0.002, duration: dur });
    this.tone({ wave: "sine", freq: freq * 4, gain: gain * 0.34, delay, attack: 0.001, duration: dur * 0.45 });
    this.tone({ wave: "triangle", freq: freq * 2, gain: gain * 0.16, delay, attack: 0.002, duration: dur * 0.7 });
  }

  // ── PUBLIC SOUND PALETTE ───────────────────────────────────────────────────

  /**
   * tap — a very short, soft tick: a tile joining the trace. Cheap and subtle
   * (played rapidly during a drag), so it's a single high-ish blip at low gain
   * with a tiny envelope that won't pile up.
   */
  tap(): void {
    if (!this.ready()) return;
    // A soft wooden tile-clack: a quick band-passed noise tick + a low body knock.
    this.noise({ type: "bandpass", freq: 1650, q: 1.3, gain: 0.05, duration: 0.032 });
    this.tone({ wave: "triangle", freq: 216, gain: 0.045, attack: 0.001, duration: 0.05 });
  }

  /**
   * found — the reward chime for a valid word. This is the "money" sound: a warm
   * two/three-note bloom that rises with the word's point value. `points`
   * (roughly 1..11) maps to an ascending root pitch, and higher scores add a
   * bright octave sparkle so a big find feels genuinely bigger.
   */
  found(points: number): void {
    if (!this.ready()) return;

    // Clamp to 1..11, map to a warm pentatonic ascent — the marimba climbs with
    // the word's value: a woody bloom that gets brighter + fuller for a big find.
    const p = Math.max(1, Math.min(11, Math.round(points)));
    const scale = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]; // C-major pentatonic ladder
    const semis = scale[Math.min(scale.length - 1, p - 1)]!;
    const root = 261.63 * Math.pow(2, semis / 12); // C4, climbing (marimba register)

    // A woody marimba root + a warm fifth, lightly arpeggiated (the tactile core).
    this.marimba(root, 0.17, 0, 0.44);
    this.marimba(root * 1.5, 0.1, 0.05, 0.36);
    // Bigger words bloom into a soft bell shimmer on top — the "payoff crunch".
    if (p >= 5) {
      this.tone({ wave: "sine", freq: root * 2, gain: 0.07, delay: 0.09, attack: 0.003, duration: 0.5 });
    }
    if (p >= 8) {
      this.tone({ wave: "sine", freq: root * 3, gain: 0.035, delay: 0.12, attack: 0.003, duration: 0.42 });
    }
  }

  /**
   * invalid — a soft, non-harsh "no" for a rejected/dead-end word. A muted wooden
   * thud (low-passed noise + a low downward knock), correcting gently, never a buzzer.
   */
  invalid(): void {
    if (!this.ready()) return;
    this.noise({ type: "lowpass", freq: 360, q: 0.7, gain: 0.09, duration: 0.12 });
    this.tone({ wave: "triangle", freq: [150, 92], gain: 0.06, attack: 0.003, duration: 0.14 });
  }

  /**
   * tick — a quiet clock tick for the final ~10 seconds of a timed round. A soft
   * WOODEN tick (a very short low-passed noise blip + a low body knock) rather
   * than a pure sine — subtle, a background pulse that suits the organic palette.
   */
  tick(): void {
    if (!this.ready()) return;
    this.noise({ type: "lowpass", freq: 520, q: 0.9, gain: 0.045, duration: 0.028 });
    this.tone({ wave: "triangle", freq: 300, gain: 0.03, attack: 0.001, duration: 0.035 });
  }

  /**
   * coin — a warm CERAMIC/wooden clink for coins gained or spent. NOT a metallic
   * cha-ching: two quick, soft high plinks (marimba-ish sines around ~700 + ~1050
   * Hz), very short and low-gain, lightly arpeggiated. Cozy and satisfying.
   */
  coin(): void {
    if (!this.ready()) return;
    this.marimba(700, 0.08, 0, 0.16);
    this.marimba(1050, 0.06, 0.045, 0.14);
  }

  /**
   * relicShimmer — a soft, glassy bell "ping" for when a relic fires during
   * scoring: a gentle high sine plus a quiet harmonic, with a quick attack and a
   * short shimmer tail. Quiet enough to layer under `found` without clutter —
   * "a little magic sparkle", warm rather than chimey-harsh.
   */
  relicShimmer(): void {
    if (!this.ready()) return;
    this.tone({ wave: "sine", freq: 1244.51, gain: 0.05, attack: 0.004, duration: 0.36 }); // D#6
    this.tone({ wave: "sine", freq: 1864.66, gain: 0.022, delay: 0.03, attack: 0.004, duration: 0.28 }); // D#7
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
   * begin — a warm MARIMBA lift when a round starts: a quick three-note rising
   * flourish (root → fifth → octave, E4–B4–E5) on the woody marimba helper,
   * organic to match the palette: "here we go".
   */
  begin(): void {
    if (!this.ready()) return;
    this.marimba(329.63, 0.12, 0, 0.26); // E4
    this.marimba(493.88, 0.11, 0.1, 0.3); // B4
    this.marimba(659.25, 0.09, 0.19, 0.34); // E5
  }

  /**
   * levelClear — a smooth, calm chime for beating a board: a gentle rising major
   * arpeggio (C–E–G–C) on soft sines with a slow release, over a warm low root.
   * Reassuring and resolved, never loud.
   */
  levelClear(): void {
    if (!this.ready()) return;
    // A warm resolved marimba arpeggio (C–E–G–C) over a soft low root — cozy,
    // accomplished, never loud.
    const notes = [261.63, 329.63, 392.0, 523.25]; // C4 E4 G4 C5
    notes.forEach((f, i) => this.marimba(f, 0.11, i * 0.11, 0.7));
    this.tone({ wave: "triangle", freq: 130.81, gain: 0.06, attack: 0.02, duration: 1.0 });
  }

  /**
   * chime — a lightweight, calm twinkle for the WOVENWILD studio ident, played as
   * the mark's eyes open (the "newborn" moment). Two soft high sine bells with a
   * slow bloom — gentle and brief, never a jingle. Silent on a stone-cold first
   * load (audio still locked pre-gesture); plays on later visits once unlocked.
   */
  chime(): void {
    if (!this.ready()) return;
    this.tone({ wave: "sine", freq: 987.77, gain: 0.07, attack: 0.012, duration: 0.5 }); // B5
    this.tone({ wave: "sine", freq: 1318.51, gain: 0.05, delay: 0.13, attack: 0.012, duration: 0.6 }); // E6
  }

  /**
   * thwup — the frog's tongue flick: a quick, soft, wet pop. A fast downward
   * pitch glide with a snappy envelope, layered with a higher click for the
   * "wet" edge. Meant to land in sync with the tongue animation.
   */
  thwup(): void {
    if (!this.ready()) return;
    this.tone({ wave: "triangle", freq: [640, 150], gain: 0.15, attack: 0.002, duration: 0.12 });
    this.tone({ wave: "sine", freq: [1150, 320], gain: 0.07, attack: 0.001, duration: 0.08 });
  }
}

/** The shared singleton — import and call anywhere; safe before `unlock()`. */
export const sound = new SoundManager();
