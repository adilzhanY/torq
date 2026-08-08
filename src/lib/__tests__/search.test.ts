import { describe, expect, it } from "vitest";
import { haystack, matches, matchesText, tokenize } from "../search";

describe("tokenize", () => {
  it("splits on whitespace and lowercases", () => {
    expect(tokenize("  Bench  Press ")).toEqual(["bench", "press"]);
  });

  it("is empty for an empty query", () => {
    expect(tokenize("   ")).toEqual([]);
  });
});

describe("matches", () => {
  const bench = ["Cable Lying Biceps Curl", "arms", "cable", "biceps"];

  it("finds a row when every word appears, in any order", () => {
    expect(matches("bicep curl", bench)).toBe(true);
    expect(matches("curl bicep", bench)).toBe(true);
  });

  it("requires ALL words, not any", () => {
    expect(matches("bicep squat", bench)).toBe(false);
  });

  it("searches equipment and muscles, not just the name", () => {
    expect(matches("cable", bench)).toBe(true);
    expect(matches("arms", bench)).toBe(true);
  });

  it("matches everything on an empty query", () => {
    expect(matches("", bench)).toBe(true);
    expect(matches("   ", bench)).toBe(true);
  });

  it("ignores case", () => {
    expect(matches("BICEPS", bench)).toBe(true);
  });
});

describe("haystack / matchesText", () => {
  it("gives the same answer as the one-shot matches()", () => {
    const fields = ["Barbell Bench Press", "chest", "barbell", "pectorals"];
    const text = haystack(fields);
    for (const q of ["bench", "barbell press", "chest", "squat", ""]) {
      expect(matchesText(tokenize(q), text), q).toBe(matches(q, fields));
    }
  });

  it("pre-lowercases so the typing path does no case work", () => {
    expect(haystack(["Barbell BENCH Press"])).toBe("barbell bench press");
  });
});
