/**
 * Day Quality tiers, shared by Dashboard, History, and Today so the thresholds never drift.
 * Strong = 4+ metrics net positive, Solid = 1–3 net, Off = even or below.
 */
export type DayTier = "strong" | "solid" | "off";

export function dayTier(total: number): DayTier {
  if (total >= 4) return "strong";
  if (total >= 1) return "solid";
  return "off";
}

export const DAY_TIER_LABEL: Record<DayTier, string> = { strong: "Strong", solid: "Solid", off: "Off" };

export function countDayTiers(totals: number[]): Record<DayTier, number> {
  const out: Record<DayTier, number> = { strong: 0, solid: 0, off: 0 };
  totals.forEach(t => { out[dayTier(t)]++; });
  return out;
}

/** Consecutive scored days ending today (or yesterday, if today isn't scored yet). */
export function currentStreak(scoredDates: Set<string>, todayStr: string): number {
  const d = new Date(todayStr + "T12:00:00");
  const pad = (n: number) => String(n).padStart(2, "0");
  const fmt = (x: Date) => `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
  if (!scoredDates.has(fmt(d))) d.setDate(d.getDate() - 1);
  let n = 0;
  while (scoredDates.has(fmt(d)) && n < 3660) { n++; d.setDate(d.getDate() - 1); }
  return n;
}
