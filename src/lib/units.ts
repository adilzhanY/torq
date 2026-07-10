/** Unit conversions — the one home for lb/kg and ft-in/cm math. */

export const LB_TO_KG = 0.45359237;
export const CM_PER_FT = 30.48;
export const CM_PER_IN = 2.54;

export function ftInToCm(ft: number, inch: number): number {
  return Math.round(ft * CM_PER_FT + inch * CM_PER_IN);
}

/** cm → { ft, inch } with the inch remainder normalized to 0–11. */
export function cmToFtIn(cm: number): { ft: number; inch: number } {
  const totalIn = Math.round(cm / CM_PER_IN);
  return { ft: Math.floor(totalIn / 12), inch: totalIn % 12 };
}
