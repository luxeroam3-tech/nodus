/**
 * Recurring-schedule date math — pure functions, mirrors advance_date() /
 * generate_due_rent_invoices() in supabase/migrations/20260822160000_recurring_rent.sql
 * exactly, so a client-side "next few rent dates" preview never drifts from
 * what the database will actually generate.
 */

export type Frequency = "weekly" | "monthly" | "quarterly" | "yearly";

export const FREQUENCIES: { value: Frequency; label: string }[] = [
  { value: "weekly", label: "Every week" },
  { value: "monthly", label: "Every month" },
  { value: "quarterly", label: "Every 3 months" },
  { value: "yearly", label: "Every year" },
];

/**
 * Advance a YYYY-MM-DD date by one period.
 * Month-based frequencies clamp to the last day of shorter months
 * (Jan 31 + 1 month → Feb 28/29) instead of overflowing into the next month.
 */
function parseISODate(dateISO: string): [number, number, number] {
  const [y, m, d] = dateISO.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined || Number.isNaN(y) || Number.isNaN(m) || Number.isNaN(d)) {
    throw new Error(`Invalid ISO date: ${dateISO}`);
  }
  return [y, m, d];
}

export function advance(dateISO: string, frequency: Frequency): string {
  const [y, m, d] = parseISODate(dateISO);
  if (frequency === "weekly") {
    const dt = new Date(Date.UTC(y, m - 1, d + 7));
    return dt.toISOString().slice(0, 10);
  }
  const monthsToAdd = frequency === "monthly" ? 1 : frequency === "quarterly" ? 3 : 12;
  const targetMonthIndex = m - 1 + monthsToAdd;
  const targetYear = y + Math.floor(targetMonthIndex / 12);
  const targetMonth = targetMonthIndex % 12;
  const lastDay = new Date(Date.UTC(targetYear, targetMonth + 1, 0)).getUTCDate();
  const day = Math.min(d, lastDay);
  return `${targetYear}-${String(targetMonth + 1).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/**
 * All run dates due on/before `today`, starting from nextRunDate.
 * Capped so a lease nobody touched for years can't flood a preview list —
 * matches the p_cap guard in generate_due_rent_invoices().
 */
export function dueRuns(nextRunDate: string, frequency: Frequency, today: string, cap = 12): string[] {
  const runs: string[] = [];
  let current = nextRunDate;
  while (current <= today && runs.length < cap) {
    runs.push(current);
    current = advance(current, frequency);
  }
  return runs;
}

/** The next N scheduled dates after nextRunDate, regardless of today — for UI previews. */
export function upcomingRuns(nextRunDate: string, frequency: Frequency, count = 3): string[] {
  const runs: string[] = [nextRunDate];
  let current = nextRunDate;
  for (let i = 1; i < count; i++) {
    current = advance(current, frequency);
    runs.push(current);
  }
  return runs;
}
