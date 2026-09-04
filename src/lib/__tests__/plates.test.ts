import { describe, expect, it } from "vitest";
import { BAR, PLATES, loadout, loadoutText, nearestLoadable, smallestJump } from "../plates";

const KG = PLATES.kg;
const BAR_KG = BAR.kg;

describe("loadout", () => {
  it("loads a familiar weight the way a lifter would", () => {
    // 100 kg on a 20 kg bar is 40 per side: 25 + 15.
    const l = loadout(100, BAR_KG, KG)!;
    expect(l.perSide).toEqual([25, 15]);
    expect(l.total).toBe(100);
    expect(l.exact).toBe(true);
  });

  it("handles the fiddly one the warm-up dialog produces", () => {
    // 92.5 kg: 36.25 per side, which is where people actually stall.
    const l = loadout(92.5, BAR_KG, KG)!;
    expect(l.perSide).toEqual([25, 10, 1.25]);
    expect(l.total).toBe(92.5);
  });

  it("says bar only when there is nothing to add", () => {
    const l = loadout(20, BAR_KG, KG)!;
    expect(l.perSide).toEqual([]);
    expect(loadoutText(l)).toBe("bar only");
  });

  it("refuses weights a bar cannot make", () => {
    // A 12 kg dumbbell press or a machine: not a barbell at all.
    expect(loadout(12, BAR_KG, KG)).toBeNull();
    expect(loadout(0, BAR_KG, KG)).toBeNull();
  });

  it("reports the miss when the set cannot hit it exactly", () => {
    // 91 kg needs 35.5 per side; the lightest plate is 1.25.
    const l = loadout(91, BAR_KG, KG)!;
    expect(l.exact).toBe(false);
    expect(l.total).toBe(90);
    expect(l.off).toBe(1);
  });

  it("survives floating point, which 2.5 kg plates guarantee", () => {
    const l = loadout(102.5, BAR_KG, KG)!;
    expect(l.total).toBe(102.5);
    expect(l.exact).toBe(true);
  });

  it("works in pounds off the pound plate set", () => {
    // 225 lb on a 45 lb bar is the classic: 90 per side, two 45s.
    const l = loadout(225, BAR.lb, PLATES.lb)!;
    expect(l.perSide).toEqual([45, 45]);
    expect(l.exact).toBe(true);
  });

  it("adapts to a thin plate set", () => {
    // A gym with only 20s and 10s cannot make 100 exactly from a 20 bar.
    const l = loadout(100, 20, [20, 10])!;
    expect(l.perSide).toEqual([20, 20]);
    expect(l.total).toBe(100);
    // 95 needs 37.5 a side; with only 20s and 10s you reach 30, so the bar
    // lands at 80 and the app has to say so rather than pretend.
    const odd = loadout(95, 20, [20, 10])!;
    expect(odd.total).toBe(80);
    expect(odd.off).toBe(15);
  });

  it("is greedy-optimal for real plate sets", () => {
    // Every weight the set CAN make must come out exact, which is the
    // property that justifies the greedy loop.
    for (let side = 0; side <= 60; side += 1.25) {
      const target = BAR_KG + side * 2;
      const l = loadout(target, BAR_KG, KG)!;
      expect(l.exact).toBe(true);
    }
  });
});

describe("nearestLoadable", () => {
  it("rounds DOWN to something that exists", () => {
    // Rounding up would quietly make the session harder than intended.
    expect(nearestLoadable(91.3, BAR_KG, KG)).toBe(90);
    expect(nearestLoadable(92.5, BAR_KG, KG)).toBe(92.5);
  });

  it("is null below the bar", () => {
    expect(nearestLoadable(10, BAR_KG, KG)).toBeNull();
  });
});

describe("smallestJump", () => {
  it("is twice the lightest plate, since they go on in pairs", () => {
    expect(smallestJump(KG)).toBe(2.5);
    expect(smallestJump([20, 10])).toBe(20);
    expect(smallestJump([])).toBe(0);
  });
});
