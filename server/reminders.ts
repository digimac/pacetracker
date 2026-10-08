/**
 * Automatic daily scoring reminder.
 *
 * Extends (and replaces the body of) the old admin-only `/api/admin/send-scheduled-sms`
 * job, which was SMS-only, opt-in-only, and never ran unless someone hit the endpoint.
 *
 * Rules (per user, evaluated in the user's own timezone):
 *  - Default first reminder at 08:00 local time (user-adjustable in Settings).
 *  - Sent by the user's preferred method ONLY — email OR sms, never both, and no fallback.
 *  - SMS only goes to users with a phone on file who have opted in (smsOptIn).
 *  - Skip users who already scored today (local day).
 *  - Skip users who were already reminded today (reminder_log, enforced by a unique index).
 *  - Skip users with no saved timezone (missing, invalid, or never confirmed — signup
 *    writes a placeholder "America/New_York" that isn't the user's real choice).
 *  - Every attempted send is logged to reminder_log (sent / failed + error).
 *
 * The scheduler ticks every 5 minutes. A reminder is "due" from its time until
 * CATCH_UP_MINUTES later, so a late tick or a quick restart doesn't drop the day's
 * reminder, but a long outage won't fire an 8 AM reminder in the afternoon.
 */
import { storage } from "./storage";
import { sendDailyScoreReminderEmail } from "./email";
import { sendDailyScoreReminderSms } from "./sms";
import type { User, UserSchedule } from "@shared/schema";

export const DAILY_REMINDER_KIND = "daily_score";
export const DEFAULT_REMINDER_TIME = "08:00";
export const CATCH_UP_MINUTES = 60;
const TICK_MS = 5 * 60 * 1000;
const ADMIN_EMAIL = "track@sweetmo.io";

export type SkipReason =
  | "admin_account"
  | "reminders_off"
  | "no_timezone"
  | "not_due"
  | "already_reminded"
  | "already_scored"
  | "sms_not_opted_in"
  | "no_email";

export type ReminderRunSummary = {
  checkedAt: string;
  dryRun: boolean;
  considered: number;
  sent: number;
  failed: number;
  wouldSend: number;
  skipped: Partial<Record<SkipReason, number>>;
  results: { userId: number; email: string; outcome: "sent" | "failed" | "would_send"; channel: "email" | "sms"; localDate: string; error?: string }[];
};

/** Validate an IANA timezone string. */
export function isValidTimeZone(tz: string | null | undefined): tz is string {
  if (!tz || typeof tz !== "string") return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

/** Current local calendar date (YYYY-MM-DD) and minutes-since-midnight in `tz`. */
export function getLocalClock(tz: string, now: Date): { date: string; minutes: number } {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const get = (t: string) => parts.find(p => p.type === t)?.value ?? "00";
  const hour = Number(get("hour")) % 24;
  return { date: `${get("year")}-${get("month")}-${get("day")}`, minutes: hour * 60 + Number(get("minute")) };
}

/** Parse "HH:MM" → minutes since midnight; falls back to the 08:00 default. */
export function parseReminderTime(value: string | null | undefined): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (m) {
    const h = Number(m[1]), min = Number(m[2]);
    if (h >= 0 && h < 24 && min >= 0 && min < 60) return h * 60 + min;
  }
  return 8 * 60;
}

export function isReminderDue(nowMinutes: number, reminderMinutes: number): boolean {
  return nowMinutes >= reminderMinutes && nowMinutes < reminderMinutes + CATCH_UP_MINUTES;
}

function maskEmail(email: string): string {
  const [local, domain] = email.split("@");
  if (!domain) return "***";
  return `${local.slice(0, 1)}***@${domain}`;
}
function maskPhone(phone: string): string {
  const digits = phone.replace(/\D/g, "");
  return digits.length >= 4 ? `***-***-${digits.slice(-4)}` : "***";
}

async function hasScoredOn(userId: number, localDate: string): Promise<boolean> {
  const entry = await storage.getDailyEntry(userId, localDate);
  if (!entry) return false;
  const scores = await storage.getMetricScoresByEntry(entry.id);
  return scores.length > 0;
}

/**
 * Evaluate every user once and send any reminders that are due right now.
 * `dryRun` reports who would be reminded without sending or logging anything.
 */
export async function runDailyReminders(opts: { now?: Date; dryRun?: boolean } = {}): Promise<ReminderRunSummary> {
  const now = opts.now ?? new Date();
  const dryRun = !!opts.dryRun;
  const summary: ReminderRunSummary = {
    checkedAt: now.toISOString(), dryRun, considered: 0, sent: 0, failed: 0, wouldSend: 0, skipped: {}, results: [],
  };
  const skip = (r: SkipReason) => { summary.skipped[r] = (summary.skipped[r] ?? 0) + 1; };

  const rows = await storage.getUsersWithSchedules();
  for (const { user, schedule } of rows as { user: User; schedule: UserSchedule }[]) {
    summary.considered++;
    try {
      if (user.email === ADMIN_EMAIL) { skip("admin_account"); continue; }
      if (!schedule.reminderEnabled) { skip("reminders_off"); continue; }

      // No saved timezone → skip (never guess; a wrong guess means a 5 AM text).
      const tz = schedule.timezone;
      if (!schedule.timezoneConfirmed || !isValidTimeZone(tz)) { skip("no_timezone"); continue; }

      const clock = getLocalClock(tz, now);
      if (!isReminderDue(clock.minutes, parseReminderTime(schedule.reminderTime))) { skip("not_due"); continue; }

      if (await storage.getReminderLogEntry(user.id, DAILY_REMINDER_KIND, clock.date)) { skip("already_reminded"); continue; }
      if (await hasScoredOn(user.id, clock.date)) { skip("already_scored"); continue; }

      // Preferred method only. If SMS is preferred but the user isn't opted in (e.g. they
      // texted STOP), we skip entirely — no silent fallback to email.
      const channel: "email" | "sms" = schedule.reminderMethod === "sms" ? "sms" : "email";
      if (channel === "sms" && (!user.phone || !user.smsOptIn)) { skip("sms_not_opted_in"); continue; }
      if (channel === "email" && !user.email) { skip("no_email"); continue; }

      if (dryRun) {
        summary.wouldSend++;
        summary.results.push({ userId: user.id, email: user.email, outcome: "would_send", channel, localDate: clock.date });
        continue;
      }

      // Reserve the slot first so overlapping runs / multiple instances can't double-send.
      const claim = await storage.claimReminderSend({
        userId: user.id,
        kind: DAILY_REMINDER_KIND,
        localDate: clock.date,
        channel,
        destination: channel === "sms" ? maskPhone(user.phone!) : maskEmail(user.email),
        timezone: tz,
      });
      if (!claim) { skip("already_reminded"); continue; }

      const displayName = user.firstName || user.displayName || user.email;
      const result = channel === "sms"
        ? await sendDailyScoreReminderSms({ to: user.phone!, displayName })
        : await sendDailyScoreReminderEmail({ toEmail: user.email, displayName });

      // A failed attempt still counts as "reminded" for the day — we don't retry, to avoid spamming.
      await storage.updateReminderLog(claim.id, {
        status: result.ok ? "sent" : "failed",
        providerId: (result as any).sid ?? null,
        error: result.ok ? null : (result.error ?? "Unknown error"),
      });
      if (result.ok) summary.sent++; else summary.failed++;
      summary.results.push({ userId: user.id, email: user.email, outcome: result.ok ? "sent" : "failed", channel, localDate: clock.date, error: result.ok ? undefined : result.error });
    } catch (err: any) {
      console.error(`[reminders] Error for user ${user.id}:`, err?.message || err);
      summary.failed++;
    }
  }
  return summary;
}

let running = false;
let timer: NodeJS.Timeout | null = null;

/** Run once, guarding against overlapping ticks. Returns null if a run is already in progress. */
export async function tickReminders(opts: { dryRun?: boolean } = {}): Promise<ReminderRunSummary | null> {
  if (running && !opts.dryRun) return null;
  if (!opts.dryRun) running = true;
  try {
    const summary = await runDailyReminders(opts);
    if (!opts.dryRun && (summary.sent || summary.failed)) {
      console.log(`[reminders] ${summary.checkedAt} sent=${summary.sent} failed=${summary.failed} skipped=${JSON.stringify(summary.skipped)}`);
    }
    return summary;
  } finally {
    if (!opts.dryRun) running = false;
  }
}

/**
 * Starts the in-process scheduler. On by default in production; set
 * REMINDER_SCHEDULER=off to disable, or REMINDER_SCHEDULER=on to run it in dev.
 */
export function startReminderScheduler(): void {
  const flag = (process.env.REMINDER_SCHEDULER || "").toLowerCase();
  const enabled = flag === "on" || (flag !== "off" && process.env.NODE_ENV === "production");
  if (!enabled) {
    console.log("[reminders] Scheduler disabled (set REMINDER_SCHEDULER=on to enable outside production)");
    return;
  }
  if (timer) return;
  console.log(`[reminders] Scheduler started — checking every ${TICK_MS / 60000} min`);
  const run = () => { tickReminders().catch(err => console.error("[reminders] tick failed:", err?.message || err)); };
  setTimeout(run, 30_000); // first check shortly after boot
  timer = setInterval(run, TICK_MS);
}
