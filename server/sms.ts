/**
 * SMS utility via Twilio.
 * Reads TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, TWILIO_FROM_NUMBER from env.
 * All sends are fire-and-forget safe — if Twilio is not configured or the
 * send fails, a warning is logged but no error is thrown.
 */
import twilio from "twilio";

const ACCOUNT_SID  = process.env.TWILIO_ACCOUNT_SID;
const AUTH_TOKEN   = process.env.TWILIO_AUTH_TOKEN;
const FROM_NUMBER  = process.env.TWILIO_FROM_NUMBER;
const APP_URL      = process.env.APP_URL || "https://sweetmo.io";

function isConfigured(): boolean {
  return !!(ACCOUNT_SID && AUTH_TOKEN && FROM_NUMBER);
}

/**
 * Core send — returns true on success, false on failure.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  if (!isConfigured()) {
    console.log("[sms] Twilio not configured — skipping send");
    return false;
  }
  // Normalise number — ensure it has a + prefix
  const toNorm = to.startsWith("+") ? to : `+1${to.replace(/\D/g, "")}`;
  if (toNorm.replace(/\D/g, "").length < 10) {
    console.warn(`[sms] Invalid phone number: ${to}`);
    return false;
  }
  try {
    const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
    const message = await client.messages.create({
      to: toNorm,
      from: FROM_NUMBER!,
      body,
    });
    console.log(`[sms] Sent to ${toNorm} — SID: ${message.sid}`);
    return true;
  } catch (err: any) {
    console.error(`[sms] Error sending to ${toNorm}:`, err?.message || err);
    return false;
  }
}

// ── Typed message helpers ────────────────────────────────────────────────────

export async function sendDailyReminderSms(opts: {
  to: string;
  displayName: string;
  daysSinceLastScore: number | null;
}): Promise<boolean> {
  const { to, displayName, daysSinceLastScore } = opts;
  const since =
    daysSinceLastScore === null
      ? "You haven't logged a score yet"
      : daysSinceLastScore === 1
      ? "It's been 1 day since your last score"
      : `It's been ${daysSinceLastScore} days since your last score`;

  const body =
    `Hey ${displayName}! ${since}. ` +
    `Score today and keep your momentum going → ${APP_URL}/#/today\n` +
    `Reply STOP to unsubscribe.`;

  return sendSms(to, body);
}

export async function sendWelcomeSms(opts: {
  to: string;
  displayName: string;
}): Promise<boolean> {
  const body =
    `Welcome to Sweet Momentum, ${opts.displayName}! 🎯 ` +
    `Start scoring your day at ${APP_URL}/#/today\n` +
    `Reply STOP to unsubscribe.`;
  return sendSms(opts.to, body);
}

export async function sendPartnerScoredSms(opts: {
  to: string;
  partnerName: string;
  score: number;
}): Promise<boolean> {
  const { to, partnerName, score } = opts;
  const scoreStr = score > 0 ? `+${score}` : `${score}`;
  const body =
    `Your momentum partner ${partnerName} just scored ${scoreStr} today. ` +
    `Check your network → ${APP_URL}/#/network\n` +
    `Reply STOP to unsubscribe.`;
  return sendSms(to, body);
}
