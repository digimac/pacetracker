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

// Real connectivity + auth check against the Twilio API — does NOT send a message
// (account fetch + number lookup are free/no-cost calls). Distinguishes
// "credentials missing" from "credentials rejected" from "number not usable" from "working".
export async function checkTwilioStatus(): Promise<{
  configured: boolean;
  fromNumber: string;
  accountSidMasked: string;
  verified: boolean;
  accountStatus: string | null;
  numberFound: boolean;
  numberSmsCapable: boolean | null;
  error: string | null;
}> {
  const maskedSid = ACCOUNT_SID ? ACCOUNT_SID.slice(0, 6) + "***" : "(not set)";

  if (!ACCOUNT_SID || !AUTH_TOKEN || !FROM_NUMBER) {
    const missing = [
      !ACCOUNT_SID && "TWILIO_ACCOUNT_SID",
      !AUTH_TOKEN && "TWILIO_AUTH_TOKEN",
      !FROM_NUMBER && "TWILIO_FROM_NUMBER",
    ].filter(Boolean).join(", ");
    return {
      configured: false,
      fromNumber: FROM_NUMBER || "(not set)",
      accountSidMasked: maskedSid,
      verified: false,
      accountStatus: null,
      numberFound: false,
      numberSmsCapable: null,
      error: `Missing environment variable(s): ${missing}. SMS sends are silently skipped until these are set on Render.`,
    };
  }

  try {
    const client = twilio(ACCOUNT_SID, AUTH_TOKEN);

    // 1. Verify the account credentials actually authenticate
    const account = await client.api.accounts(ACCOUNT_SID).fetch();

    // 2. Confirm the FROM number exists on this account and can send SMS
    const numbers = await client.incomingPhoneNumbers.list({ phoneNumber: FROM_NUMBER, limit: 1 });
    const number = numbers[0];

    if (!number) {
      return {
        configured: true,
        fromNumber: FROM_NUMBER,
        accountSidMasked: maskedSid,
        verified: true,
        accountStatus: account.status,
        numberFound: false,
        numberSmsCapable: null,
        error: `Authenticated successfully, but TWILIO_FROM_NUMBER (${FROM_NUMBER}) was not found on this account. Check the number is correct and belongs to this Twilio account.`,
      };
    }

    const smsCapable = !!number.capabilities?.sms;
    return {
      configured: true,
      fromNumber: FROM_NUMBER,
      accountSidMasked: maskedSid,
      verified: true,
      accountStatus: account.status,
      numberFound: true,
      numberSmsCapable: smsCapable,
      error: smsCapable ? null : `The number ${FROM_NUMBER} exists on this account but is not SMS-capable.`,
    };
  } catch (err: any) {
    return {
      configured: true,
      fromNumber: FROM_NUMBER,
      accountSidMasked: maskedSid,
      verified: false,
      accountStatus: null,
      numberFound: false,
      numberSmsCapable: null,
      error: err?.message || String(err),
    };
  }
}

/**
 * Detailed send — returns the outcome plus the real Twilio error message (if any)
 * so callers like the admin test-send route can surface a specific diagnosis
 * instead of a bare success/fail.
 */
export async function sendSmsDetailed(to: string, body: string): Promise<{ ok: boolean; sid?: string; error?: string }> {
  if (!isConfigured()) {
    const msg = "Twilio not configured — TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN, and/or TWILIO_FROM_NUMBER are missing.";
    console.log(`[sms] ${msg}`);
    return { ok: false, error: msg };
  }
  // Normalise number — ensure it has a + prefix
  const toNorm = to.startsWith("+") ? to : `+1${to.replace(/\D/g, "")}`;
  if (toNorm.replace(/\D/g, "").length < 10) {
    const msg = `Invalid phone number: ${to}`;
    console.warn(`[sms] ${msg}`);
    return { ok: false, error: msg };
  }
  try {
    const client = twilio(ACCOUNT_SID, AUTH_TOKEN);
    const message = await client.messages.create({
      to: toNorm,
      from: FROM_NUMBER!,
      body,
    });
    console.log(`[sms] Sent to ${toNorm} — SID: ${message.sid}`);
    return { ok: true, sid: message.sid };
  } catch (err: any) {
    const msg = err?.message || String(err);
    console.error(`[sms] Error sending to ${toNorm}:`, msg);
    return { ok: false, error: msg };
  }
}

/**
 * Core send — returns true on success, false on failure.
 * Thin wrapper over sendSmsDetailed() for the many fire-and-forget callers
 * that only care about a boolean outcome.
 */
export async function sendSms(to: string, body: string): Promise<boolean> {
  const result = await sendSmsDetailed(to, body);
  return result.ok;
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
