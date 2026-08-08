/**
 * The split is a business decision, so the tests pin the PROMISES rather
 * than the current flag values: logging and backup stay free, the paid list
 * is never empty, and nothing can be both.
 */
import { describe, expect, it } from "vitest";
import { can, FEATURES, paidFeatures, unlock, type Feature } from "../entitlements";

describe("the free/paid split", () => {
  it("never charges for keeping your own data", () => {
    // Holding a user's training history hostage is not a business model.
    expect(FEATURES.cloudSync.free).toBe(true);
  });

  it("has something to sell", () => {
    expect(paidFeatures().length).toBeGreaterThan(0);
  });

  it("describes every feature, so the paywall can never render a blank row", () => {
    for (const key of Object.keys(FEATURES) as Feature[]) {
      expect(FEATURES[key].label.length, key).toBeGreaterThan(0);
      expect(FEATURES[key].pitch.length, key).toBeGreaterThan(0);
    }
  });

  it("lists exactly the non-free features as paid", () => {
    const paid = new Set(paidFeatures().map((f) => f.key));
    for (const key of Object.keys(FEATURES) as Feature[]) {
      expect(paid.has(key), key).toBe(!FEATURES[key].free);
    }
  });
});

describe("can()", () => {
  it("always allows free features", () => {
    expect(can("cloudSync")).toBe(true);
  });

  it("allows everything while billing is unwired", () => {
    // The guard that stops us shipping a paywall over features nobody can
    // buy yet. When billing lands this expectation should be revisited
    // deliberately, not silently.
    for (const key of Object.keys(FEATURES) as Feature[]) {
      expect(can(key), key).toBe(true);
    }
  });
});

describe("unlock()", () => {
  it("refuses honestly rather than pretending to take money", async () => {
    const res = await unlock();
    expect(res.ok).toBe(false);
    expect(res.error).toBeTruthy();
  });
});
