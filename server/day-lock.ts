/**
 * Day lock: a day's scores can only be entered or changed on that day itself,
 * in the member's own timezone. Once local midnight passes, the day is closed
 * for good — no edits, no late back-fills, no pre-scoring future days.
 */
import { storage } from "./storage";
import { isValidTimeZone, getLocalClock } from "./reminders";

export const DAY_LOCKED_CODE = "DAY_LOCKED";

/** Today's date (YYYY-MM-DD) in the member's saved timezone (UTC if none saved). */
export async function getMemberToday(userId: number, now: Date = new Date()): Promise<string> {
  const sched = await storage.getUserSchedule(userId);
  const tz = isValidTimeZone(sched?.timezone) ? sched!.timezone! : "UTC";
  return getLocalClock(tz, now).date;
}

/** Returns null if `dateStr` is the member's today, otherwise a user-facing reason. */
export async function dayLockReason(userId: number, dateStr: string): Promise<string | null> {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) return "Invalid date.";
  const today = await getMemberToday(userId);
  if (dateStr === today) return null;
  return dateStr < today
    ? "This day has passed and is locked. Scores can only be entered or changed on the day itself."
    : "You can't score a day that hasn't happened yet.";
}
