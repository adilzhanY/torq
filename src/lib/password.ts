/**
 * Password policy for the sign-up screen — the client half of it. The server
 * enforces its own minimum (Supabase Auth), but a rule the user can SEE while
 * typing is what actually produces a strong password, so the checklist and
 * the meter both come from this one module.
 *
 * Pure functions, no React: the screen renders whatever these return.
 */

/** Passwords nobody may use, however well they satisfy the character rules. */
const BANNED = [
  "12345678910",
  "1234567890",
  "123456789",
  "password",
  "password1",
  "qwertyuiop",
  "qwerty123",
  "iloveyou",
  "letmein",
  "welcome",
  "admin123",
  "abc12345",
  "torq1234",
];

export const MIN_LENGTH = 10;

export interface Rule {
  key: string;
  label: string;
  ok: boolean;
}

/** Every rule with its current pass/fail, in the order they're shown. */
export function passwordRules(password: string, email = ""): Rule[] {
  const p = password;
  const local = email.split("@")[0]?.toLowerCase() ?? "";
  const lower = p.toLowerCase();
  return [
    { key: "len", label: `At least ${MIN_LENGTH} characters`, ok: p.length >= MIN_LENGTH },
    { key: "case", label: "Upper and lower case", ok: /[a-z]/.test(p) && /[A-Z]/.test(p) },
    { key: "num", label: "A number", ok: /\d/.test(p) },
    { key: "sym", label: "A symbol (!?@#…)", ok: /[^A-Za-z0-9]/.test(p) },
    {
      key: "guess",
      label: "Not a common or obvious password",
      ok:
        p.length > 0 &&
        !BANNED.some((b) => lower.includes(b)) &&
        !isSequential(lower) &&
        !isRepeated(lower) &&
        (local.length < 3 || !lower.includes(local)),
    },
  ];
}

/** "abcdef" / "123456" / "654321" — a straight run through the keyboard. */
function isSequential(p: string): boolean {
  if (p.length < 4) return false;
  let up = 1;
  let down = 1;
  for (let i = 1; i < p.length; i++) {
    const d = p.charCodeAt(i) - p.charCodeAt(i - 1);
    up = d === 1 ? up + 1 : 1;
    down = d === -1 ? down + 1 : 1;
    if (up >= 5 || down >= 5) return true;
  }
  return false;
}

/** "aaaaaa" / "abababab" — a short pattern tiled to length. */
function isRepeated(p: string): boolean {
  if (p.length < 4) return false;
  for (const unit of [1, 2, 3]) {
    if (p.length % unit !== 0) continue;
    const head = p.slice(0, unit);
    if (p === head.repeat(p.length / unit)) return true;
  }
  return false;
}

export function passwordOk(password: string, email = ""): boolean {
  return passwordRules(password, email).every((r) => r.ok);
}

export type StrengthLabel = "Too weak" | "Weak" | "Fair" | "Strong" | "Excellent";

export interface Strength {
  /** 0..1 for the meter. */
  score: number;
  label: StrengthLabel;
}

/**
 * Meter value: the rules carry most of it, with a length bonus on top so a
 * long passphrase still reads as stronger than a 10-character minimum.
 */
export function passwordStrength(password: string, email = ""): Strength {
  if (!password) return { score: 0, label: "Too weak" };
  const rules = passwordRules(password, email);
  const passed = rules.filter((r) => r.ok).length / rules.length;
  const lengthBonus = Math.min(1, Math.max(0, (password.length - MIN_LENGTH) / 8));
  const variety = new Set(password).size / Math.max(8, password.length);
  const score = Math.min(1, passed * 0.7 + lengthBonus * 0.2 + variety * 0.1);
  const label: StrengthLabel =
    !rules.every((r) => r.ok)
      ? score < 0.45
        ? "Too weak"
        : "Weak"
      : score < 0.8
        ? "Fair"
        : score < 0.92
          ? "Strong"
          : "Excellent";
  return { score, label };
}

/** Cheap client-side email sanity check (the server is the real judge). */
export function emailOk(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim());
}
