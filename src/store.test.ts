/**
 * store.test — contract tests for the kit-backed persistence layer.
 *
 * The store is a module-level singleton backed (under vitest/node, where there
 * is no localStorage) by the kit settings module's in-memory fallback. That is
 * exactly the get/set contract we care about here; real localStorage round-trips
 * are the kit module's own concern and are tested there. Because the singleton
 * persists across assertions within this file, tests use DISTINCT mode ids and
 * monotonically-increasing scores so they don't interfere with one another.
 */
import { describe, it, expect } from "vitest";
import { getBest, setBest, getMuted, setMuted } from "./store.ts";

describe("best scores", () => {
  it("defaults to 0 for an untouched mode", () => {
    expect(getBest("standard")).toBe(0);
    expect(getBest("does-not-exist")).toBe(0);
  });

  it("setBest raises the stored best", () => {
    setBest("advanced", 42);
    expect(getBest("advanced")).toBe(42);
    setBest("advanced", 100);
    expect(getBest("advanced")).toBe(100);
  });

  it("setBest does NOT lower the stored best", () => {
    setBest("master", 200);
    expect(getBest("master")).toBe(200);
    setBest("master", 50); // lower — ignored
    expect(getBest("master")).toBe(200);
    setBest("master", 200); // equal — ignored
    expect(getBest("master")).toBe(200);
  });

  it("tracks bests independently per mode", () => {
    setBest("zen", 7);
    expect(getBest("zen")).toBe(7);
    // A different mode's best is unaffected.
    expect(getBest("standard")).toBe(0);
  });

  it("ignores non-finite scores", () => {
    setBest("standard", Number.NaN);
    expect(getBest("standard")).toBe(0);
    setBest("standard", Infinity);
    expect(getBest("standard")).toBe(0);
  });
});

describe("mute preference", () => {
  it("defaults to false", () => {
    expect(getMuted()).toBe(false);
  });

  it("round-trips through set/get", () => {
    setMuted(true);
    expect(getMuted()).toBe(true);
    setMuted(false);
    expect(getMuted()).toBe(false);
  });
});
