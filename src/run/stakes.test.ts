import { describe, it, expect } from "vitest";
import { stakeRules, STAKES, STAKE_COUNT, clampStake, stakeAt } from "./stakes.js";

describe("stakeRules", () => {
  it("stake 1 (White) is the neutral base", () => {
    expect(stakeRules(1)).toEqual({
      targetMult: 1,
      rewardMult: 1,
      interest: true,
      bossOnBig: false,
      playsDelta: 0,
    });
  });

  it("is CUMULATIVE — a higher stake keeps every lower stake's rule", () => {
    expect(stakeRules(2).rewardMult).toBeCloseTo(0.75); // Red
    const r3 = stakeRules(3);
    expect(r3.rewardMult).toBeCloseTo(0.75); // kept from Red
    expect(r3.interest).toBe(false); // Green adds

    const r5 = stakeRules(5); // Gold: everything folded in
    expect(r5.rewardMult).toBeCloseTo(0.75);
    expect(r5.interest).toBe(false);
    expect(r5.bossOnBig).toBe(true);
    expect(r5.targetMult).toBeCloseTo(1.2);
    expect(r5.playsDelta).toBe(-1);
  });

  it("clamps out-of-range stakes to the ladder", () => {
    expect(stakeRules(0)).toEqual(stakeRules(1));
    expect(stakeRules(999)).toEqual(stakeRules(STAKE_COUNT));
    expect(clampStake(0)).toBe(1);
    expect(clampStake(999)).toBe(STAKE_COUNT);
  });

  it("stakeAt resolves tiers; the ladder is well-formed", () => {
    expect(stakeAt(1).name).toBe("White");
    expect(STAKES).toHaveLength(STAKE_COUNT);
    STAKES.forEach((s, i) => expect(s.id).toBe(i + 1));
  });
});
