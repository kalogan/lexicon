/**
 * music — LEXICON's procedural AMBIENT MUSIC bed (standalone Web Audio singleton).
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 * A warm, contemplative, slowly-evolving ambient loop that sits UNDER the game
 * as a background bed — lo-fi/ambient study-music energy: tasteful, hypnotic,
 * never distracting. It is fully SYNTHESIZED (oscillators + filters + gain
 * envelopes) — there are no audio asset files, no samples, and NO imports from
 * chimera or game-kit. Only the platform Web Audio API and the shared mute store.
 *
 * It is completely separate from sound.ts: its OWN AudioContext + master gain,
 * so nothing is shared with the SFX bus. The only thing music and SFX share is
 * the MUTE preference (via ./store.js) so a single toggle silences both.
 *
 * ── MUSICAL DESIGN ──────────────────────────────────────────────────────────
 * Key of A minor, drifting toward a soft lydian brightness. A slow four-chord
 * progression — Am · F · C · G (i · VI · III · VII) — each chord held ~8 seconds
 * so it swells and blooms rather than strums. Each pad chord is three notes,
 * every note voiced by two slightly-DETUNED sawtooth oscillators run through a
 * gentle LOWPASS filter for warmth, with a long attack/release so chords breathe
 * in and out of each other with no hard edges. A shared, very slow LFO drifts the
 * pad filter cutoff up and down across the whole loop for movement. Over the top
 * sits a SPARSE melodic motif on a soft triangle+sine voice, drawn from the
 * A-minor pentatonic (A C D E G) and placed with lots of space — a few notes per
 * chord, never a busy lead — plus a barely-there octave shimmer. A subtle
 * sub-bass sine pulses the root of each chord underneath. The whole thing is one
 * ~32-second phrase that loops seamlessly (the progression resolves G→Am so the
 * loop point lands warm), and a slow counter nudges melody-note selection each
 * cycle so successive loops are never quite identical.
 *
 * ── SCHEDULING ──────────────────────────────────────────────────────────────
 * A look-ahead scheduler: a setInterval wakes every ~25ms and schedules any
 * events whose start time falls within the next ~0.1s onto the audio clock, then
 * advances a playhead. Every voice is a THROWAWAY node graph (osc(s) + gain
 * [+ filter]) scheduled with absolute start/stop times; an `onended` handler
 * disconnects it so nothing leaks. We never hold one oscillator for the whole
 * song. stop() clears the interval (no more scheduling) and fades the master out.
 *
 * ── SAFETY ──────────────────────────────────────────────────────────────────
 * SSR / no-AudioContext safe: everything is guarded on `typeof window` and the
 * presence of an AudioContext constructor. Autoplay policy leaves a fresh context
 * suspended until a gesture — start() resumes it. Every method is a graceful
 * no-op (never throws) when audio is unavailable, suspended, or muted.
 */

import { getMuted, setMuted as storeSetMuted } from "./store.js";

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

// ── TIMING / STRUCTURE ────────────────────────────────────────────────────────

/** Seconds each chord is held — long, so pads swell rather than strum. */
const CHORD_SEC = 8;
/** Chords in the progression. */
const CHORD_COUNT = 4;
/** One full loop's length in seconds (~32s). */
const LOOP_SEC = CHORD_SEC * CHORD_COUNT;

/** Master ceiling — a quiet background bed, well under the SFX bus. */
const MASTER_CEILING = 0.15;

// ── SCHEDULER TUNING ──────────────────────────────────────────────────────────

/** How often the scheduler wakes (ms). */
const TICK_MS = 25;
/** How far ahead of the audio clock we schedule each tick (seconds). */
const LOOKAHEAD_SEC = 0.1;

// ── PITCHES ───────────────────────────────────────────────────────────────────

/**
 * Equal-tempered frequencies we use, named by note+octave. A-minor palette plus
 * the pad-chord tones and a couple of sub-bass roots.
 */
const HZ = {
  // Sub-bass roots (one per chord).
  A1: 55.0,
  F1: 43.65,
  C2: 65.41,
  G1: 49.0,
  // Pad register (mid).
  A2: 110.0,
  C3: 130.81,
  E3: 164.81,
  F2: 87.31,
  A3: 220.0,
  G2: 98.0,
  B2: 123.47,
  D3: 146.83,
  // Melody register (A-minor pentatonic across two octaves).
  A4: 440.0,
  C5: 523.25,
  D5: 587.33,
  E5: 659.25,
  G5: 783.99,
  A5: 880.0,
} as const;

/** One chord: three pad tones + its sub-bass root + which melody notes are OK. */
interface Chord {
  /** The three pad-chord frequencies (mid register). */
  pad: [number, number, number];
  /** Sub-bass root pulsed under the chord. */
  sub: number;
  /** Pentatonic melody notes that sit well over this chord. */
  scale: number[];
}

/**
 * The progression: Am · F · C · G (i · VI · III · VII in A minor). Voiced close
 * so the pad moves smoothly, and each chord carries a small pool of consonant
 * melody notes.
 */
const PROGRESSION: readonly Chord[] = [
  // Am — A C E
  { pad: [HZ.A2, HZ.C3, HZ.E3], sub: HZ.A1, scale: [HZ.A4, HZ.C5, HZ.E5, HZ.A5] },
  // F — F A C
  { pad: [HZ.F2, HZ.A2, HZ.C3], sub: HZ.F1, scale: [HZ.C5, HZ.D5, HZ.A4, HZ.G5] },
  // C — C E G
  { pad: [HZ.C3, HZ.E3, HZ.G2], sub: HZ.C2, scale: [HZ.C5, HZ.E5, HZ.G5, HZ.D5] },
  // G — G B D
  { pad: [HZ.G2, HZ.B2, HZ.D3], sub: HZ.G1, scale: [HZ.D5, HZ.E5, HZ.G5, HZ.A5] },
];

// ── EVENT MODEL ───────────────────────────────────────────────────────────────

/** A pad-chord voice: a detuned, filtered, slow-swelling sustained tone. */
interface PadEvent {
  kind: "pad";
  /** Start time within the loop (seconds). */
  at: number;
  /** How long it sounds (seconds). */
  dur: number;
  freq: number;
  gain: number;
}

/** A soft plucked/blown melody note (triangle core + sine octave shimmer). */
interface LeadEvent {
  kind: "lead";
  at: number;
  dur: number;
  freq: number;
  gain: number;
}

/** A low, slow sub-bass swell under a chord. */
interface SubEvent {
  kind: "sub";
  at: number;
  dur: number;
  freq: number;
  gain: number;
}

type Event = PadEvent | LeadEvent | SubEvent;

/**
 * Tiny deterministic PRNG (mulberry32) — seeded per loop so melody placement
 * varies loop-to-loop without ever using Math.random (keeps things reproducible
 * and prevents accidental clustering/clipping).
 */
function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Build ONE loop's worth of events, given a seed that varies the melody. Pads +
 * sub are fixed (the harmonic bed is stable); the lead motif is placed sparsely
 * with seeded jitter so successive loops feel alive, not copy-pasted.
 */
function buildLoop(seed: number): Event[] {
  const rng = mulberry32(seed);
  const events: Event[] = [];

  for (let i = 0; i < CHORD_COUNT; i++) {
    const chord = PROGRESSION[i];
    const chordStart = i * CHORD_SEC;
    // Overlap each chord slightly into the next so pads crossfade — no gaps at
    // chord boundaries (and none at the loop seam, since attack/release are long).
    const padDur = CHORD_SEC + 2.5;

    // ── Pad: three detuned, filtered tones, held long and quiet.
    for (const f of chord.pad) {
      events.push({ kind: "pad", at: chordStart, dur: padDur, freq: f, gain: 0.09 });
    }

    // ── Sub-bass: one soft low swell per chord.
    events.push({ kind: "sub", at: chordStart, dur: CHORD_SEC + 1, freq: chord.sub, gain: 0.11 });

    // ── Lead: 1–2 sparse notes per chord, placed in the back half so they land
    // as the pad has fully bloomed, with seeded pitch + timing so it evolves.
    const noteCount = rng() > 0.45 ? 2 : 1;
    for (let n = 0; n < noteCount; n++) {
      // Spread notes across the chord's timespan, biased later.
      const slot = (n + 1) / (noteCount + 1);
      const jitter = (rng() - 0.5) * 1.2;
      const at = chordStart + CHORD_SEC * (0.35 + slot * 0.5) + jitter;
      const freq = chord.scale[Math.floor(rng() * chord.scale.length)];
      const dur = 2.4 + rng() * 1.6;
      events.push({ kind: "lead", at, dur, freq, gain: 0.13 });
    }
  }

  return events;
}

// ── THE SINGLETON ─────────────────────────────────────────────────────────────

class Music {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  /** Output of the slow LFO driving pad filter cutoff (movement). The LFO osc
   *  itself stays alive via this connection + the running context. */
  private lfoGain: GainNode | null = null;

  /** Scheduler interval id (undefined ⇒ not scheduling). */
  private interval: number | undefined;
  /** Whether the loop is currently running (drives idempotency). */
  private running = false;
  /**
   * Whether music is "wanted" — i.e. start() was called and not stop()ed. Lets
   * an unmute resume playback that a mute paused.
   */
  private wanted = false;

  /** Audio-clock time the current loop started (playhead anchor). */
  private loopStart = 0;
  /** Events for the current loop, sorted by start time. */
  private queue: Event[] = [];
  /** Index of the next event in `queue` to schedule. */
  private qi = 0;
  /** Loop counter — seeds melody variation. */
  private loopIndex = 0;

  // ── PUBLIC API ──────────────────────────────────────────────────────────────

  /**
   * Create/resume the AudioContext and begin the loop. Idempotent (a second
   * call while already running does nothing). No-op if muted or if audio is
   * unavailable in this environment.
   */
  start(): void {
    this.wanted = true;
    if (getMuted()) return;
    if (this.running) return;

    const ctx = this.ensureContext();
    if (!ctx || !this.master) return;

    // Autoplay policy may leave the context suspended until a gesture — try to
    // resume; if it stays suspended the scheduler still runs and voices simply
    // won't sound until the context unlocks (no throw, no leak).
    void ctx.resume().catch(() => {});

    this.running = true;

    // Fade the master up from silence to the quiet ceiling.
    const now = ctx.currentTime;
    this.master.gain.cancelScheduledValues(now);
    this.master.gain.setValueAtTime(0.0001, now);
    this.master.gain.exponentialRampToValueAtTime(MASTER_CEILING, now + 1.5);

    // Anchor the first loop just ahead of "now" and build its event queue.
    this.loopStart = now + 0.15;
    this.loadLoop();

    this.interval = window.setInterval(() => this.tick(), TICK_MS);
  }

  /**
   * Fade out gracefully (~0.6s) and halt scheduling. Safe to call anytime
   * (before start, twice in a row, etc.).
   */
  stop(): void {
    this.wanted = false;
    this.haltScheduling();

    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) {
      this.running = false;
      return;
    }
    const now = ctx.currentTime;
    try {
      master.gain.cancelScheduledValues(now);
      // Anchor to the current value, then ease to near-silence over ~0.6s.
      const cur = Math.max(master.gain.value, 0.0001);
      master.gain.setValueAtTime(cur, now);
      master.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    } catch {
      // Ignore — context may be closing; nothing else to do.
    }
    this.running = false;
  }

  /**
   * Persist the mute choice to the shared store, then apply it: muting stops
   * playback; unmuting resumes it IF music is currently wanted.
   */
  setMuted(m: boolean): void {
    storeSetMuted(m);
    if (m) {
      const wasWanted = this.wanted;
      this.stop();
      // stop() clears `wanted`; keep the intent so a later unmute resumes.
      this.wanted = wasWanted;
    } else if (this.wanted) {
      this.start();
    }
  }

  /** Whether sound is muted — delegates to the shared store. */
  isMuted(): boolean {
    return getMuted();
  }

  // ── INTERNALS ─────────────────────────────────────────────────────────────

  /** Lazily create the context + master + LFO. Returns null if unavailable. */
  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = getAudioContextCtor();
    if (!Ctor) return null;

    let ctx: AudioContext;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }

    const master = ctx.createGain();
    master.gain.value = 0.0001;
    master.connect(ctx.destination);

    // A shared slow filter LFO the pad voices tap for gentle cutoff drift. We
    // keep it as a control-rate source: its output (Hz offset) is added to each
    // pad filter's frequency AudioParam.
    const lfo = ctx.createOscillator();
    lfo.type = "sine";
    lfo.frequency.value = 0.05; // one sweep per ~20s — very slow.
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 350; // +/- 350 Hz of cutoff movement.
    lfo.connect(lfoGain);
    try {
      lfo.start();
    } catch {
      // Already started or unavailable — ignore.
    }

    this.ctx = ctx;
    this.master = master;
    this.lfoGain = lfoGain;
    return ctx;
  }

  /** Clear the scheduler interval so no further events are queued. */
  private haltScheduling(): void {
    if (this.interval !== undefined) {
      window.clearInterval(this.interval);
      this.interval = undefined;
    }
  }

  /** (Re)build the event queue for the current loop and reset its cursor. */
  private loadLoop(): void {
    this.queue = buildLoop(0x51 ^ (this.loopIndex * 0x9e37));
    this.queue.sort((a, b) => a.at - b.at);
    this.qi = 0;
  }

  /**
   * Scheduler heartbeat: schedule any events starting within the lookahead
   * window, and roll over to the next loop when the playhead crosses the loop
   * boundary. Guarded so a dead/suspended context never throws.
   */
  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || !this.running) return;

    const horizon = ctx.currentTime + LOOKAHEAD_SEC;

    // Schedule everything from the current loop whose absolute start is due.
    while (this.qi < this.queue.length) {
      const e = this.queue[this.qi];
      const absAt = this.loopStart + e.at;
      if (absAt > horizon) break;
      try {
        this.scheduleEvent(e, absAt);
      } catch {
        // A single bad voice must not kill the loop.
      }
      this.qi++;
    }

    // When we've scheduled past this loop's end, advance to the next loop.
    if (this.qi >= this.queue.length && this.loopStart + LOOP_SEC <= horizon) {
      this.loopStart += LOOP_SEC;
      this.loopIndex++;
      this.loadLoop();
    }
  }

  /** Route one event to its voice builder. */
  private scheduleEvent(e: Event, at: number): void {
    switch (e.kind) {
      case "pad":
        this.playPad(e, at);
        break;
      case "lead":
        this.playLead(e, at);
        break;
      case "sub":
        this.playSub(e, at);
        break;
    }
  }

  // ── VOICES (throwaway node graphs, self-disconnecting on `ended`) ───────────

  /**
   * A warm pad tone: two detuned sawtooths through a lowpass filter (whose cutoff
   * the shared LFO drifts), with a long swell in and long release out.
   */
  private playPad(e: PadEvent, at: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 900;
    filter.Q.value = 0.4;
    if (this.lfoGain) {
      // Add LFO Hz offset onto the filter cutoff for slow movement.
      this.lfoGain.connect(filter.frequency);
    }

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    filter.connect(gain);
    gain.connect(master);

    const attack = 2.2;
    const release = 2.8;
    const peak = e.gain;
    const end = at + e.dur;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(peak, at + attack);
    gain.gain.setValueAtTime(peak, Math.max(at + attack, end - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    const oscs: OscillatorNode[] = [];
    for (const detune of [-6, 6]) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = e.freq;
      osc.detune.value = detune;
      osc.connect(filter);
      osc.start(at);
      osc.stop(end + 0.05);
      oscs.push(osc);
    }

    const cleanup = () => {
      try {
        if (this.lfoGain) this.lfoGain.disconnect(filter.frequency);
      } catch {
        /* already disconnected */
      }
      for (const o of oscs) {
        try {
          o.disconnect();
        } catch {
          /* ignore */
        }
      }
      try {
        filter.disconnect();
      } catch {
        /* ignore */
      }
      try {
        gain.disconnect();
      } catch {
        /* ignore */
      }
    };
    oscs[oscs.length - 1].onended = cleanup;
  }

  /**
   * A soft melody note: a triangle core with a quiet sine an octave up so it
   * blooms rather than snaps — gentle attack, exponential release.
   */
  private playLead(e: LeadEvent, at: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(master);

    const end = at + e.dur;
    const attack = 0.25;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(e.gain, at + attack);
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    const core = ctx.createOscillator();
    core.type = "triangle";
    core.frequency.value = e.freq;
    core.connect(gain);
    core.start(at);
    core.stop(end + 0.05);

    // A quiet octave-up sine shimmer, mixed low.
    const shimmerGain = ctx.createGain();
    shimmerGain.gain.value = 0.0001;
    shimmerGain.connect(master);
    shimmerGain.gain.setValueAtTime(0.0001, at + 0.04);
    shimmerGain.gain.exponentialRampToValueAtTime(e.gain * 0.28, at + attack + 0.1);
    shimmerGain.gain.exponentialRampToValueAtTime(0.0001, end);

    const shimmer = ctx.createOscillator();
    shimmer.type = "sine";
    shimmer.frequency.value = e.freq * 2;
    shimmer.connect(shimmerGain);
    shimmer.start(at + 0.04);
    shimmer.stop(end + 0.05);

    const cleanup = () => {
      for (const n of [core, shimmer, gain, shimmerGain]) {
        try {
          n.disconnect();
        } catch {
          /* ignore */
        }
      }
    };
    core.onended = cleanup;
  }

  /** A low, slow sub-bass swell under the chord — felt more than heard. */
  private playSub(e: SubEvent, at: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const gain = ctx.createGain();
    gain.gain.value = 0.0001;
    gain.connect(master);

    const end = at + e.dur;
    const attack = 1.8;
    const release = 1.8;
    gain.gain.setValueAtTime(0.0001, at);
    gain.gain.exponentialRampToValueAtTime(e.gain, at + attack);
    gain.gain.setValueAtTime(e.gain, Math.max(at + attack, end - release));
    gain.gain.exponentialRampToValueAtTime(0.0001, end);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.value = e.freq;
    osc.connect(gain);
    osc.start(at);
    osc.stop(end + 0.05);

    osc.onended = () => {
      for (const n of [osc, gain]) {
        try {
          n.disconnect();
        } catch {
          /* ignore */
        }
      }
    };
  }
}

/** The shared singleton — start/stop it from screens. */
export const music = new Music();
