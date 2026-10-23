/**
 * Server side of the Google Analytics measurement for Simple mode.
 *
 * The server decides the facts (is this a new scored day? first ever? a week-2 return?)
 * because it has the full history and the member's timezone. The client only forwards
 * these facts to GA, so events can't double-fire from re-saves, multiple tabs, or devices.
 */
import { storage } from "./storage";
import { isValidTimeZone } from "./reminders";

export type AppMode = "simple" | "full";

export async function getAppMode(): Promise<AppMode> {
  try {
    const raw = await storage.getAppSetting("simple_mode");
    return raw === undefined || raw === "true" ? "simple" : "full";
  } catch {
    return "simple";
  }
}

function localDate(tz: string, d: Date): string {
  return d.toLocaleDateString("en-CA", { timeZone: tz }); // YYYY-MM-DD
}
function dayDiff(a: string, b: string): number {
  return Math.round((Date.parse(a + "T00:00:00Z") - Date.parse(b + "T00:00:00Z")) / 86_400_000);
}
function addDays(d: string, n: number): string {
  const t = new Date(d + "T00:00:00Z");
  t.setUTCDate(t.getUTCDate() + n);
  return t.toISOString().slice(0, 10);
}
/** ISO week label like "2026-W43" — the signup cohort. */
export function isoWeek(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00Z");
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  const yearStart = Date.UTC(d.getUTCFullYear(), 0, 1);
  const week = Math.ceil(((d.getTime() - yearStart) / 86_400_000 + 1) / 7);
  return `${d.getUTCFullYear()}-W${String(week).padStart(2, "0")}`;
}

async function userTimezone(userId: number): Promise<string> {
  const sched = await storage.getUserSchedule(userId);
  return isValidTimeZone(sched?.timezone) ? sched!.timezone! : "America/New_York";
}

export type ScoreAnalytics = {
  newDay: boolean;           // first time this date was scored (fire score_day)
  appMode: AppMode;
  signupAppMode: string;     // "simple" | "full" | "pre_simple"
  daysSinceSignup: number;   // 0 = signup day, measured on the member's local calendar
  isToday: boolean;          // false = back-filling an earlier day from History
  totalDaysScored: number;
  daysScoredLast7: number;   // rolling 7 local days ending today, including this one
  isFirstScore: boolean;     // fire first_score
  retainedD7: boolean;       // first scored day in days 7–13 after signup (fire retained_d7)
};

/**
 * Call right after a score write. Claims the entry for analytics; only the first
 * write of a day gets newDay=true and the milestone flags.
 */
export async function buildScoreAnalytics(userId: number, entryId: number, entryDate: string): Promise<ScoreAnalytics | null> {
  try {
    const newDay = await storage.claimEntryAnalytics(entryId);
    const [user, tz, appMode] = await Promise.all([storage.getUserById(userId), userTimezone(userId), getAppMode()]);
    if (!user) return null;
    const today = localDate(tz, new Date());
    const signupDate = localDate(tz, new Date(user.createdAt));
    const daysSinceSignup = Math.max(0, dayDiff(today, signupDate));
    const entries = await storage.getDailyEntriesByRange(userId, "2000-01-01", today);
    const dates = new Set(entries.map(e => e.entryDate));
    dates.add(entryDate);
    const last7Start = addDays(today, -6);
    const daysScoredLast7 = Array.from(dates).filter(d => d >= last7Start && d <= today).length;
    const isToday = entryDate === today;
    const w2Start = addDays(signupDate, 7), w2End = addDays(signupDate, 13);
    const week2Days = Array.from(dates).filter(d => d >= w2Start && d <= w2End).length;
    return {
      newDay,
      appMode,
      signupAppMode: (user as any).signupAppMode || "pre_simple",
      daysSinceSignup,
      isToday,
      totalDaysScored: dates.size,
      daysScoredLast7,
      isFirstScore: newDay && dates.size === 1,
      retainedD7: newDay && isToday && daysSinceSignup >= 7 && daysSinceSignup <= 13 && week2Days === 1,
    };
  } catch (err: any) {
    console.warn("[analytics] buildScoreAnalytics failed:", err?.message || err);
    return null; // analytics must never break scoring
  }
}

/** Identity + user properties the client sets on gtag once per session. */
export async function getAnalyticsContext(userId: number) {
  const [user, tz, appMode] = await Promise.all([storage.getUserById(userId), userTimezone(userId), getAppMode()]);
  if (!user) return null;
  const signupDate = localDate(tz, new Date(user.createdAt));
  return {
    userId: String(user.id),        // internal numeric id, never email
    isInternal: user.email === "track@sweetmo.io",
    appMode,
    signupAppMode: (user as any).signupAppMode || "pre_simple",
    signupWeek: isoWeek(signupDate),
    signupDate,
  };
}
