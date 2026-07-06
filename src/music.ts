/**
 * music — LEXICON's procedural MUSIC bed (standalone Web Audio singleton).
 *
 * ── WHAT THIS IS ─────────────────────────────────────────────────────────────
 * A cozy LO-FI STUDY BEAT — the "cozy scholar" vibe made musical. Where the old
 * bed was a formless ambient pad wash, this is an actual tune with a pulse:
 * a swung, brush-soft drum groove under warm Rhodes electric-piano chords, a
 * round upright bass, a sparse vibraphone melody, and a little tape/vinyl warmth
 * over the top. Think a jazzy lo-fi loop you'd leave on while reading — present
 * and grooving, but never busy enough to distract from the words.
 *
 * It is fully SYNTHESIZED (oscillators + filtered noise + gain envelopes) — no
 * audio asset files, no samples, and NO imports from chimera or game-kit. Only
 * the platform Web Audio API and the shared mute store.
 *
 * It is completely separate from sound.ts: its OWN AudioContext + master bus, so
 * nothing is shared with the SFX bus. The only thing music and SFX share is the
 * MUTE preference (via ./store.js) so a single toggle silences both.
 *
 * ── MUSICAL DESIGN ──────────────────────────────────────────────────────────
 * ~72 BPM, gently SWUNG eighths (the off-beat lands late), key of F major. An
 * eight-bar loop over a warm jazzy turnaround —
 *   Fmaj7 · Dm7 · Gm7 · C7 · Am7 · Dm7 · Gm7 · C7
 * (I · vi · ii · V · iii · vi · ii · V — home is F, with a ii-V pull each half).
 * One bar per chord. Voices:
 *   • Rhodes EP — each chord a soft rolled stab (sine body + a bright 2×/4× "tine"
 *     that decays fast, the signature electric-piano bell attack). A quieter
 *     syncopated re-stab on the "and of three" some bars.
 *   • Upright bass — round triangle+sub through a lowpass; root on beat one, a
 *     fifth/octave on beat three, a little swing.
 *   • Drums — a sine "pitch-drop" kick (1 and the & of 3), a filtered-noise brush
 *     snare on the backbeat (2 and 4), and swung closed hats on the eighths.
 *   • Vibraphone melody — sparse, seeded, a note or two per bar from the chord's
 *     tones in the upper register, so successive loops are never identical.
 *   • Tape warmth — the whole mix runs through a master lowpass (muffled, felt),
 *     plus a few tiny vinyl crackle pops per bar for cozy texture.
 *
 * ── SCHEDULING ──────────────────────────────────────────────────────────────
 * A look-ahead scheduler: a setInterval wakes every ~25ms and schedules any
 * events whose start time falls within the next ~0.1s onto the audio clock, then
 * advances a playhead. Every voice is a THROWAWAY node graph scheduled with
 * absolute start/stop times; an `onended` handler disconnects it so nothing
 * leaks. stop() clears the interval and fades the master out.
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

/** Beats per minute — an easy, heads-nodding lo-fi tempo. */
const BPM = 72;
/** Seconds per beat. */
const SPB = 60 / BPM;
/** Beats per bar (common time). */
const BEATS_PER_BAR = 4;
/** Seconds per bar. */
const BAR_SEC = BEATS_PER_BAR * SPB;
/** Bars in one full loop (the 8-chord turnaround). */
const BARS = 8;
/** One full loop's length in seconds (~26.7s). */
const LOOP_SEC = BARS * BAR_SEC;
/** Swing: where the off-beat eighth lands, as a fraction of a beat (>0.5 = late). */
const SWING = 0.59;

/** Master ceiling — a warm background bed, under the SFX bus. */
const MASTER_CEILING = 0.2;

// ── SCHEDULER TUNING ──────────────────────────────────────────────────────────

/** How often the scheduler wakes (ms). */
const TICK_MS = 25;
/** How far ahead of the audio clock we schedule each tick (seconds). */
const LOOKAHEAD_SEC = 0.1;

// ── PITCHES ───────────────────────────────────────────────────────────────────

/** Equal-tempered frequency for a MIDI note number (A4 = 69 = 440Hz). */
const hz = (midi: number): number => 440 * Math.pow(2, (midi - 69) / 12);

/** One chord in the turnaround: a Rhodes voicing, a bass root, a melody pool. */
interface Chord {
  /** Rhodes voicing — MIDI notes, mid register (around C4 = 60). */
  notes: number[];
  /** Bass root — MIDI note, low register. */
  bass: number;
  /** Consonant melody notes (MIDI, upper register) for the vibraphone. */
  mel: number[];
}

/**
 * The eight-bar turnaround in F major: Fmaj7 · Dm7 · Gm7 · C7 · Am7 · Dm7 · Gm7 · C7.
 * Voiced close so the Rhodes moves smoothly; each chord carries a small pool of
 * consonant upper-register melody notes.
 */
const PROGRESSION: readonly Chord[] = [
  // Fmaj7 — F A C E
  { notes: [53, 57, 60, 64], bass: 41, mel: [72, 76, 77, 81] },
  // Dm7 — D F A C
  { notes: [50, 53, 57, 60], bass: 38, mel: [74, 77, 81, 72] },
  // Gm7 — G Bb D F
  { notes: [55, 58, 62, 65], bass: 43, mel: [74, 77, 79, 82] },
  // C7 — C E G Bb
  { notes: [48, 52, 55, 58], bass: 36, mel: [72, 76, 79, 82] },
  // Am7 — A C E G
  { notes: [57, 60, 64, 67], bass: 45, mel: [72, 76, 79, 81] },
  // Dm7
  { notes: [50, 53, 57, 60], bass: 38, mel: [74, 77, 81, 72] },
  // Gm7
  { notes: [55, 58, 62, 65], bass: 43, mel: [74, 77, 79, 82] },
  // C7
  { notes: [48, 52, 55, 58], bass: 36, mel: [72, 76, 79, 82] },
];

// ── EVENT MODEL ───────────────────────────────────────────────────────────────

/** A scheduled musical event; kind selects the voice, fields tune it. */
interface Event {
  kind: "rhodes" | "bass" | "kick" | "snare" | "hat" | "lead" | "crackle";
  /** Start time within the loop (seconds). */
  at: number;
  /** Pitch (Hz) — pitched voices only. */
  freq?: number;
  /** How long it sounds (seconds) — for the longer voices. */
  dur?: number;
  /** Peak gain. */
  gain?: number;
}

/**
 * Tiny deterministic PRNG (mulberry32) — seeded per loop so melody/fill placement
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

/** Time (seconds within the loop) of a beat position in a bar. */
const beatAt = (bar: number, beat: number): number => bar * BAR_SEC + beat * SPB;

/**
 * Build ONE loop's worth of events, given a seed that varies the melody + fills.
 * The groove + harmony are stable; the vibraphone motif, ghost hits and crackle
 * are placed with seeded jitter so successive loops feel alive, not copy-pasted.
 */
function buildLoop(seed: number): Event[] {
  const rng = mulberry32(seed);
  const ev: Event[] = [];

  for (let bar = 0; bar < BARS; bar++) {
    const chord = PROGRESSION[bar % PROGRESSION.length]!;

    // ── Rhodes: a soft, slightly-rolled chord stab on beat one.
    chord.notes.forEach((m, idx) => {
      ev.push({ kind: "rhodes", at: beatAt(bar, 0) + idx * 0.014, freq: hz(m), dur: 2.4, gain: 0.07 });
    });
    // A quieter syncopated re-stab on the "and of three" some bars, for lift.
    if (rng() > 0.42) {
      chord.notes.forEach((m, idx) => {
        ev.push({ kind: "rhodes", at: beatAt(bar, 2 + SWING) + idx * 0.01, freq: hz(m), dur: 1.3, gain: 0.04 });
      });
    }

    // ── Upright bass: root on one, a fifth/octave on three (a touch of walk).
    ev.push({ kind: "bass", at: beatAt(bar, 0), freq: hz(chord.bass), dur: 0.95, gain: 0.14 });
    ev.push({
      kind: "bass",
      at: beatAt(bar, 2),
      freq: hz(chord.bass + (rng() > 0.5 ? 12 : 7)),
      dur: 0.75,
      gain: 0.1,
    });

    // ── Drums: kick (1 + & of 3), backbeat brush-snare (2, 4), swung hats.
    ev.push({ kind: "kick", at: beatAt(bar, 0), gain: 0.34 });
    ev.push({ kind: "kick", at: beatAt(bar, 2 + SWING), gain: 0.3 });
    if (rng() > 0.72) ev.push({ kind: "kick", at: beatAt(bar, 3 + SWING), gain: 0.24 });
    ev.push({ kind: "snare", at: beatAt(bar, 1), gain: 0.13 });
    ev.push({ kind: "snare", at: beatAt(bar, 3), gain: 0.13 });
    for (let b = 0; b < BEATS_PER_BAR; b++) {
      ev.push({ kind: "hat", at: beatAt(bar, b), gain: 0.05 });
      ev.push({ kind: "hat", at: beatAt(bar, b + SWING), gain: 0.033 }); // swung, softer
    }

    // ── Vibraphone melody: sparse — 0–2 notes in the back half of the bar.
    if (rng() > 0.4) {
      const n = rng() > 0.62 ? 2 : 1;
      for (let k = 0; k < n; k++) {
        const beat = 1.5 + k * 1.3 + (rng() - 0.5) * 0.5;
        const m = chord.mel[Math.floor(rng() * chord.mel.length)]!;
        ev.push({ kind: "lead", at: beatAt(bar, beat), freq: hz(m), dur: 1.1 + rng() * 0.7, gain: 0.085 });
      }
    }

    // ── Vinyl crackle: a few tiny pops per bar for cozy tape texture.
    const pops = 1 + Math.floor(rng() * 3);
    for (let p = 0; p < pops; p++) {
      ev.push({ kind: "crackle", at: bar * BAR_SEC + rng() * BAR_SEC, gain: 0.015 + rng() * 0.02 });
    }
  }

  return ev;
}

// ── THE SINGLETON ─────────────────────────────────────────────────────────────

class Music {
  private ctx: AudioContext | null = null;
  /** Voice bus — everything routes here; feeds the tape lowpass → destination. */
  private master: GainNode | null = null;
  /** Reusable white-noise buffer for the drum/crackle voices. */
  private noiseBuf: AudioBuffer | null = null;

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
    this.master.gain.exponentialRampToValueAtTime(MASTER_CEILING, now + 1.2);

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

  /** Lazily create the context + master bus + tape lowpass + noise buffer. */
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

    // Voice bus → tape lowpass (muffled lo-fi warmth) → destination.
    const master = ctx.createGain();
    master.gain.value = 0.0001;
    const tape = ctx.createBiquadFilter();
    tape.type = "lowpass";
    tape.frequency.value = 2600; // roll off the top so it feels warm/felt, not crisp
    tape.Q.value = 0.5;
    master.connect(tape);
    tape.connect(ctx.destination);

    // One second of white noise, reused by the drums + crackle.
    const buf = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate);
    const data = buf.getChannelData(0);
    let s = 0x2f6e2b1;
    for (let i = 0; i < data.length; i++) {
      // cheap deterministic noise (no Math.random)
      s = (Math.imul(s, 1103515245) + 12345) & 0x7fffffff;
      data[i] = (s / 0x40000000 - 1) * 0.9;
    }

    this.ctx = ctx;
    this.master = master;
    this.noiseBuf = buf;
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

    while (this.qi < this.queue.length) {
      const e = this.queue[this.qi]!;
      const absAt = this.loopStart + e.at;
      if (absAt > horizon) break;
      try {
        this.scheduleEvent(e, absAt);
      } catch {
        // A single bad voice must not kill the loop.
      }
      this.qi++;
    }

    if (this.qi >= this.queue.length && this.loopStart + LOOP_SEC <= horizon) {
      this.loopStart += LOOP_SEC;
      this.loopIndex++;
      this.loadLoop();
    }
  }

  /** Route one event to its voice builder. */
  private scheduleEvent(e: Event, at: number): void {
    switch (e.kind) {
      case "rhodes":
        this.playRhodes(e, at);
        break;
      case "bass":
        this.playBass(e, at);
        break;
      case "kick":
        this.playKick(e, at);
        break;
      case "snare":
        this.playSnare(e, at);
        break;
      case "hat":
        this.playHat(e, at);
        break;
      case "lead":
        this.playLead(e, at, true);
        break;
      case "crackle":
        this.playCrackle(e, at);
        break;
    }
  }

  // ── VOICES (throwaway node graphs, self-disconnecting on `ended`) ───────────

  /** A one-shot noise burst through a filter — the drums' + crackle's engine. */
  private playNoise(
    at: number,
    dur: number,
    gain: number,
    filter: { type: BiquadFilterType; freq: number; q?: number },
    attack = 0.001,
  ): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master || !this.noiseBuf) return;

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const biq = ctx.createBiquadFilter();
    biq.type = filter.type;
    biq.frequency.value = filter.freq;
    biq.Q.value = filter.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    src.connect(biq);
    biq.connect(g);
    g.connect(master);

    const end = at + dur;
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(gain, at + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, end);

    src.start(at);
    src.stop(end + 0.02);
    src.onended = () => {
      for (const n of [src, biq, g]) {
        try {
          n.disconnect();
        } catch {
          /* ignore */
        }
      }
    };
  }

  /**
   * Rhodes electric-piano tone: a sine body plus bright 2×/4× "tine" partials that
   * decay faster than the body — the signature EP bell attack, soft and warm.
   */
  private playRhodes(e: Event, at: number): void {
    this.epVoice(at, e.freq ?? 220, e.dur ?? 2, e.gain ?? 0.07, false);
  }

  /** Vibraphone melody note — same EP engine, a touch brighter + longer ring. */
  private playLead(e: Event, at: number, bright: boolean): void {
    this.epVoice(at, e.freq ?? 440, e.dur ?? 1.3, e.gain ?? 0.085, bright);
  }

  /** Shared Rhodes/vibes engine: stacked sine partials with per-partial decay. */
  private epVoice(at: number, freq: number, dur: number, gain: number, bright: boolean): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const partial = (mult: number, g: number, d: number, attack: number) => {
      const out = ctx.createGain();
      out.gain.value = 0.0001;
      out.connect(master);
      const end = at + d;
      out.gain.setValueAtTime(0.0001, at);
      out.gain.exponentialRampToValueAtTime(g, at + attack);
      out.gain.exponentialRampToValueAtTime(0.0001, end);
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.value = freq * mult;
      osc.connect(out);
      osc.start(at);
      osc.stop(end + 0.05);
      osc.onended = () => {
        try {
          osc.disconnect();
          out.disconnect();
        } catch {
          /* ignore */
        }
      };
    };

    partial(1, gain, dur, 0.006); // body
    partial(2, gain * 0.34, dur * 0.5, 0.004); // tine (bell attack, faster decay)
    partial(bright ? 4 : 3, gain * (bright ? 0.12 : 0.07), dur * 0.3, 0.003); // sparkle
  }

  /** Upright bass: a round triangle + sine sub through a lowpass. */
  private playBass(e: Event, at: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const freq = e.freq ?? 55;
    const dur = e.dur ?? 0.9;
    const gain = e.gain ?? 0.14;

    const filter = ctx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.value = 480;
    filter.Q.value = 0.7;
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    filter.connect(out);
    out.connect(master);

    const end = at + dur;
    out.gain.setValueAtTime(0.0001, at);
    out.gain.exponentialRampToValueAtTime(gain, at + 0.02);
    out.gain.setValueAtTime(gain, Math.max(at + 0.02, end - 0.25));
    out.gain.exponentialRampToValueAtTime(0.0001, end);

    const oscs: OscillatorNode[] = [];
    const tri = ctx.createOscillator();
    tri.type = "triangle";
    tri.frequency.value = freq;
    tri.connect(filter);
    oscs.push(tri);
    const sub = ctx.createOscillator();
    sub.type = "sine";
    sub.frequency.value = freq;
    const subG = ctx.createGain();
    subG.gain.value = 0.6;
    sub.connect(subG);
    subG.connect(filter);
    oscs.push(sub);

    for (const o of oscs) {
      o.start(at);
      o.stop(end + 0.05);
    }
    oscs[0]!.onended = () => {
      for (const n of [...oscs, subG, filter, out]) {
        try {
          n.disconnect();
        } catch {
          /* ignore */
        }
      }
    };
  }

  /** Kick: a sine with a fast downward pitch sweep + quick decay. */
  private playKick(e: Event, at: number): void {
    const ctx = this.ctx;
    const master = this.master;
    if (!ctx || !master) return;

    const gain = e.gain ?? 0.34;
    const out = ctx.createGain();
    out.gain.value = 0.0001;
    out.connect(master);

    const osc = ctx.createOscillator();
    osc.type = "sine";
    osc.frequency.setValueAtTime(120, at);
    osc.frequency.exponentialRampToValueAtTime(44, at + 0.09);
    osc.connect(out);

    const end = at + 0.3;
    out.gain.setValueAtTime(0.0001, at);
    out.gain.exponentialRampToValueAtTime(gain, at + 0.006);
    out.gain.exponentialRampToValueAtTime(0.0001, end);

    osc.start(at);
    osc.stop(end + 0.02);
    osc.onended = () => {
      for (const n of [osc, out]) {
        try {
          n.disconnect();
        } catch {
          /* ignore */
        }
      }
    };
  }

  /** Snare: a soft filtered-noise brush on the backbeat. */
  private playSnare(e: Event, at: number): void {
    this.playNoise(at, 0.17, e.gain ?? 0.13, { type: "bandpass", freq: 1750, q: 0.7 }, 0.002);
  }

  /** Closed hat: a very short high-passed noise tick. */
  private playHat(e: Event, at: number): void {
    this.playNoise(at, 0.035, e.gain ?? 0.05, { type: "highpass", freq: 7500, q: 0.8 });
  }

  /** Vinyl crackle: a tiny mid-band noise pop for tape texture. */
  private playCrackle(e: Event, at: number): void {
    this.playNoise(at, 0.02, e.gain ?? 0.02, { type: "bandpass", freq: 2200, q: 1.2 });
  }
}

/** The shared singleton — start/stop it from screens. */
export const music = new Music();
