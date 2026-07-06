import { describe, it, expect } from "vitest";
import {
  toRunSnap,
  fromRunSnap,
  relicsFromIds,
  charmsFromIds,
  bossFromId,
  modFromId,
  saveRun,
  loadRun,
  clearRun,
  SNAP_VERSION,
  type ChallengeSnapshot,
} from "./persist.js";
import { makeRunState } from "./engine.js";

// Minimal localStorage shim for the node test env (browser has it natively).
if (typeof (globalThis as { localStorage?: unknown }).localStorage === "undefined") {
  const mem = new Map<string, string>();
  (globalThis as { localStorage?: unknown }).localStorage = {
    getItem: (k: string) => (mem.has(k) ? mem.get(k)! : null),
    setItem: (k: string, v: string) => void mem.set(k, String(v)),
    removeItem: (k: string) => void mem.delete(k),
    clear: () => mem.clear(),
  };
}

describe("persist round-trip", () => {
  it("toRunSnap/fromRunSnap preserves RunState including the Set", () => {
    const r = makeRunState();
    r.permaMult = 2.5;
    r.runWords = 7;
    r.seenFirst.add("q");
    r.seenFirst.add("z");
    r.counters["scale-hoarder"] = 1.2;
    const back = fromRunSnap(toRunSnap(r));
    expect(back.permaMult).toBe(2.5);
    expect(back.runWords).toBe(7);
    expect(back.seenFirst instanceof Set).toBe(true);
    expect(back.seenFirst.has("q")).toBe(true);
    expect(back.seenFirst.has("z")).toBe(true);
    expect(back.counters["scale-hoarder"]).toBe(1.2);
  });

  it("relicsFromIds rehydrates known ids, preserves dups, drops unknowns", () => {
    const cards = relicsFromIds(["alphabet", "alphabet", "tiny", "___nope___"]);
    expect(cards.map((c) => c.id)).toEqual(["alphabet", "alphabet", "tiny"]);
  });

  it("charm / boss / modifier ids resolve (and null is null)", () => {
    expect(charmsFromIds(["charm-extra-play"]).length).toBe(1);
    expect(bossFromId("librarian")?.id).toBe("librarian");
    expect(bossFromId(null)).toBe(null);
    expect(modFromId("golden-tile")?.id).toBe("golden-tile");
  });

  it("save / load / clear round-trips a snapshot", () => {
    clearRun();
    expect(loadRun()).toBe(null);
    const snap: ChallengeSnapshot = {
      mode: "challenge",
      v: SNAP_VERSION,
      phase: "play",
      step: 3,
      stake: 2,
      runSalt: 123,
      letters: ["a", "b", "qu"],
      relics: ["alphabet"],
      charms: ["charm-extra-play"],
      coins: 12,
      boardSeed: 99,
      boardScore: 40,
      playsLeft: 5,
      discardsLeft: 2,
      run: toRunSnap(makeRunState()),
      found: ["cat"],
      bestWord: { word: "cat", score: 40 },
      overrides: {},
      sealsCleared: false,
      doubleNext: false,
      shopStock: [],
      charmStock: [],
    };
    saveRun(snap);
    const back = loadRun();
    expect(back?.mode).toBe("challenge");
    expect((back as ChallengeSnapshot).step).toBe(3);
    expect((back as ChallengeSnapshot).letters).toEqual(["a", "b", "qu"]);
    clearRun();
    expect(loadRun()).toBe(null);
  });

  it("rejects a stale-version snapshot", () => {
    localStorage.setItem("lexicon:run", JSON.stringify({ mode: "endless", v: 9999 }));
    expect(loadRun()).toBe(null);
    clearRun();
  });
});
