import { describe, expect, it } from "vitest";
import { emailOk, passwordOk, passwordRules, passwordStrength, MIN_LENGTH } from "../password";

describe("passwordOk", () => {
  it("rejects the passwords people actually try", () => {
    for (const bad of ["12345", "1234567890", "password", "qwertyuiop", "aaaaaaaaaa"]) {
      expect(passwordOk(bad), bad).toBe(false);
    }
  });

  it("rejects anything that merely dresses up a banned word", () => {
    expect(passwordOk("Password1!")).toBe(false);
    expect(passwordOk("MyPassword1!")).toBe(false);
  });

  it("rejects a long keyboard run even with the right character classes", () => {
    expect(passwordOk("abcdefGH1!")).toBe(false);
  });

  it("rejects anything containing the email name", () => {
    expect(passwordOk("adilzhan1!A", "adilzhan@gmail.com")).toBe(false);
    // A short local part is too generic to blocklist on.
    expect(passwordOk("Gym!Rank9xy", "ab@gmail.com")).toBe(true);
  });

  it("enforces the length floor", () => {
    expect(passwordOk("Torq2026!")).toBe(false); // 9
    expect(passwordOk("Torq2026!x")).toBe(true); // 10
    expect(MIN_LENGTH).toBe(10);
  });

  it("accepts a real passphrase", () => {
    expect(passwordOk("Sunrise-Bench-42")).toBe(true);
  });

  it("requires every character class", () => {
    expect(passwordOk("alllowercase1!")).toBe(false); // no uppercase
    expect(passwordOk("ALLUPPERCASE1!")).toBe(false); // no lowercase
    expect(passwordOk("NoDigitsHere!!")).toBe(false); // no number
    expect(passwordOk("NoSymbols12345")).toBe(false); // no symbol
  });
});

describe("passwordRules", () => {
  it("reports each rule separately so the UI can show a checklist", () => {
    const rules = passwordRules("abc", "");
    expect(rules.map((r) => r.key)).toEqual(["len", "case", "num", "sym", "guess"]);
    expect(rules.every((r) => typeof r.label === "string" && r.label.length > 0)).toBe(true);
    expect(rules.find((r) => r.key === "len")!.ok).toBe(false);
  });

  it("treats an empty password as failing everything, not passing by default", () => {
    expect(passwordRules("", "").some((r) => r.ok)).toBe(false);
  });
});

describe("passwordStrength", () => {
  it("scores nothing as nothing", () => {
    expect(passwordStrength("").score).toBe(0);
    expect(passwordStrength("").label).toBe("Too weak");
  });

  it("never labels a policy-failing password as strong", () => {
    for (const bad of ["12345", "password", "Password1!", "abcdefGH1!"]) {
      expect(["Too weak", "Weak"]).toContain(passwordStrength(bad).label);
    }
  });

  it("rewards length beyond the minimum", () => {
    const short = passwordStrength("Torq2026!x").score;
    const long = passwordStrength("Torq2026!xTorq2026!x").score;
    expect(long).toBeGreaterThan(short);
  });

  it("keeps the score inside 0..1", () => {
    for (const p of ["a", "Torq2026!x", "Sunrise-Bench-42", "x".repeat(200)]) {
      const { score } = passwordStrength(p);
      expect(score).toBeGreaterThanOrEqual(0);
      expect(score).toBeLessThanOrEqual(1);
    }
  });
});

describe("emailOk", () => {
  it("accepts real addresses and trims", () => {
    expect(emailOk("a@b.co")).toBe(true);
    expect(emailOk("  x@y.com  ")).toBe(true);
  });

  it("rejects the obvious mistakes", () => {
    for (const bad of ["nope", "a@b", "@b.com", "a b@c.com", ""]) {
      expect(emailOk(bad), bad).toBe(false);
    }
  });
});
