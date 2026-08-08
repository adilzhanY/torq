/** Token-based exercise search, shared by the Exercises tab and the picker. */

export function tokenize(q: string): string[] {
  return q.trim().toLowerCase().split(/\s+/).filter(Boolean);
}

/** Every query word must appear somewhere in the haystack, in any order —
 * so "bicep curl" finds "Cable Biceps Curl". */
export function matches(q: string, hay: string[]): boolean {
  return matchesText(tokenize(q), haystack(hay));
}

/**
 * Flatten a row's searchable fields into one lowercase string, ONCE.
 *
 * The old path rebuilt this per row per keystroke: over 1500 catalog rows
 * that is 1500 array allocations, joins and toLowerCase calls for every
 * letter typed. Precomputing it when the list is built moves that work off
 * the typing path entirely.
 */
export function haystack(hay: string[]): string {
  return hay.join(" ").toLowerCase();
}

/** Match pre-tokenized query against a pre-lowercased haystack. */
export function matchesText(tokens: string[], text: string): boolean {
  if (!tokens.length) return true;
  return tokens.every((t) => text.includes(t));
}
