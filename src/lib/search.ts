/** Token-based exercise search, shared by the Exercises tab and the picker. */

export function tokenize(q: string): string[] {
  return q.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/** Every query word must appear somewhere in the haystack, in any order —
 * so "bicep curl" finds "Cable Biceps Curl". */
export function matches(q: string, hay: string[]): boolean {
  const tokens = tokenize(q);
  if (!tokens.length) return true;
  const text = hay.join(" ").toLowerCase();
  return tokens.every((t) => text.includes(t));
}
