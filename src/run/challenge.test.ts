import { describe, it, expect } from "vitest";
import {
  TOTAL_ANTES,
  BLINDS_PER_ANTE,
  TOTAL_BLINDS,
  blindTarget,
  challengeBlinds,
  blindAtStep,
  isWin,
} from "./challenge.js";

describe("challengeBlinds", () => {
  const blinds = challengeBlinds();

  it("has exactly TOTAL_BLINDS blinds", () => {
    expect(blinds).toHaveLength(TOTAL_BLINDS);
    expect(TOTAL_BLINDS).toBe(TOTAL_ANTES * BLINDS_PER_ANTE);
  });

  it("marks every boss blind (indexInAnte === last) and only those", () => {
    for (const b of blinds) {
      expect(b.isBoss).toBe(b.indexInAnte === BLINDS_PER_ANTE - 1);
    }
    expect(blinds.filter((b) => b.isBoss)).toHaveLength(TOTAL_ANTES);
  });

  it("runs antes 1..TOTAL_ANTES with BLINDS_PER_ANTE blinds each", () => {
    for (let a = 1; a <= TOTAL_ANTES; a++) {
      const inAnte = blinds.filter((b) => b.ante === a);
      expect(inAnte).toHaveLength(BLINDS_PER_ANTE);
      expect(inAnte.map((b) => b.indexInAnte)).toEqual([0, 1, 2]);
    }
    expect(Math.min(...blinds.map((b) => b.ante))).toBe(1);
    expect(Math.max(...blinds.map((b) => b.ante))).toBe(TOTAL_ANTES);
  });

  it("assigns steps 0..TOTAL_BLINDS-1 in order", () => {
    expect(blinds.map((b) => b.step)).toEqual(
      Array.from({ length: TOTAL_BLINDS }, (_, i) => i),
    );
  });

  it("names blinds Small / Big / Boss by index", () => {
    expect(blinds[0]!.name).toBe("Small Blind");
    expect(blinds[1]!.name).toBe("Big Blind");
    expect(blinds[2]!.name).toBe("Boss Blind");
  });
});

describe("target curve", () => {
  it("is STRICTLY INCREASING across all 15 steps in play order", () => {
    const targets = challengeBlinds().map((b) => b.target);
    for (let i = 1; i < targets.length; i++) {
      expect(targets[i]!).toBeGreaterThan(targets[i - 1]!);
    }
  });

  it("opens modest and ends on a multi-thousand capstone", () => {
    const targets = challengeBlinds().map((b) => b.target);
    expect(targets[0]).toBeGreaterThanOrEqual(60);
    expect(targets[0]).toBeLessThanOrEqual(100);
    expect(targets[targets.length - 1]).toBeGreaterThan(2000);
  });

  it("blindTarget matches the built blinds", () => {
    for (const b of challengeBlinds()) {
      expect(blindTarget(b.ante, b.indexInAnte)).toBe(b.target);
    }
  });
});

describe("blindAtStep", () => {
  it("step 0 is ante 1 small", () => {
    const b = blindAtStep(0)!;
    expect(b.ante).toBe(1);
    expect(b.indexInAnte).toBe(0);
    expect(b.isBoss).toBe(false);
  });

  it("step 14 is ante 5 boss", () => {
    const b = blindAtStep(TOTAL_BLINDS - 1)!;
    expect(b.ante).toBe(TOTAL_ANTES);
    expect(b.indexInAnte).toBe(BLINDS_PER_ANTE - 1);
    expect(b.isBoss).toBe(true);
  });

  it("is undefined past the end and before the start", () => {
    expect(blindAtStep(TOTAL_BLINDS)).toBeUndefined();
    expect(blindAtStep(-1)).toBeUndefined();
  });
});

describe("isWin", () => {
  it("is true only once the last blind is cleared", () => {
    expect(isWin(TOTAL_BLINDS)).toBe(true);
    expect(isWin(TOTAL_BLINDS - 1)).toBe(false);
    expect(isWin(0)).toBe(false);
  });
});

describe("rewards", () => {
  it("boss blinds pay a bonus over regular blinds", () => {
    const blinds = challengeBlinds();
    const boss = blinds.find((b) => b.isBoss)!;
    const regular = blinds.find((b) => !b.isBoss)!;
    expect(boss.reward).toBeGreaterThan(regular.reward);
  });
});
