/**
 * Tests for run/charms — the consumable one-shots. We guard the drop determinism
 * (same seed → same charm, always a real member), a healthy spread across seeds,
 * the starter-charm contract, and the data integrity of every charm (unique ids,
 * copy present, effect kind in the frozen union, positive time/permaMult values).
 */
import { describe, it, expect } from "vitest";
import { CHARMS, STARTER_CHARM, randomCharm, type CharmEffect } from "./charms.js";
import type { Rarity } from "./engine.js";

const EFFECT_KINDS: CharmEffect["kind"][] = [
  "time",
  "reroll",
  "doubleNext",
  "clearSeals",
  "permaMult",
];
const RARITIES: Rarity[] = ["common", "uncommon", "rare", "legendary"];

describe("randomCharm", () => {
  it("is deterministic — same seed yields the same charm", () => {
    for (const seed of [0, 1, 42, 999, 123456]) {
      expect(randomCharm(seed)).toBe(randomCharm(seed));
    }
  });

  it("always returns a member of CHARMS", () => {
    for (let seed = 0; seed < 200; seed++) {
      expect(CHARMS).toContain(randomCharm(seed));
    }
  });

  it("returns several distinct charms across seeds (not stuck on one)", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 200; seed++) seen.add(randomCharm(seed).id);
    expect(seen.size).toBeGreaterThanOrEqual(3);
  });
});

describe("STARTER_CHARM", () => {
  it("is a member of CHARMS", () => {
    expect(CHARMS).toContain(STARTER_CHARM);
  });

  it("is a time charm", () => {
    expect(STARTER_CHARM.effect.kind).toBe("time");
  });
});

describe("CHARMS data integrity", () => {
  it("has unique ids", () => {
    const ids = CHARMS.map((c) => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it("has a non-empty name and blurb, a valid rarity, and a known effect kind", () => {
    for (const c of CHARMS) {
      expect(c.name.length).toBeGreaterThan(0);
      expect(c.blurb.length).toBeGreaterThan(0);
      expect(RARITIES).toContain(c.rarity);
      expect(EFFECT_KINDS).toContain(c.effect.kind);
    }
  });

  it("has positive seconds/amount on every time/permaMult effect", () => {
    for (const c of CHARMS) {
      if (c.effect.kind === "time") expect(c.effect.seconds).toBeGreaterThan(0);
      if (c.effect.kind === "permaMult") expect(c.effect.amount).toBeGreaterThan(0);
    }
  });
});
