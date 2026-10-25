/**
 * Daily reminder SMS text: default wording, variable filling, compliance checks, and
 * segment counting. Shared by the server (send + save validation) and the Admin editor
 * (live preview), so both always agree.
 */

export const DAILY_REMINDER_SMS_KEY = "sms_daily_reminder";

/** Used whenever no custom text has been saved in Admin. Matches the original hard-coded text. */
export const DEFAULT_DAILY_REMINDER_SMS =
  "Sweet Momentum: Good morning {{displayName}}, time to score your day → {{todayUrl}}\nReply STOP to unsubscribe.";

export const DAILY_REMINDER_SMS_VARIABLES = [
  { token: "{{displayName}}", description: "Member's name" },
  { token: "{{todayUrl}}", description: "Link to Today" },
  { token: "{{settingsUrl}}", description: "Link to Settings (reminder time/method)" },
] as const;

export const DAILY_REMINDER_SMS_MAX_CHARS = 480;

export function renderDailyReminderSms(
  template: string,
  vars: { displayName: string; todayUrl: string; settingsUrl: string },
): string {
  return template
    .replace(/\{\{\s*displayName\s*\}\}/g, vars.displayName)
    .replace(/\{\{\s*todayUrl\s*\}\}/g, vars.todayUrl)
    .replace(/\{\{\s*settingsUrl\s*\}\}/g, vars.settingsUrl);
}

/** Problems that block saving. Brand name + STOP wording are promised in /sms-terms and expected by carriers. */
export function dailyReminderSmsErrors(template: string): string[] {
  const errors: string[] = [];
  const t = template.trim();
  if (!t) errors.push("The text can't be empty.");
  if (!/sweet\s*momentum/i.test(t)) errors.push('Include "Sweet Momentum" so members know who the text is from.');
  if (!/\bSTOP\b/.test(t)) errors.push('Include opt-out wording with STOP, e.g. "Reply STOP to unsubscribe."');
  if (t.length > DAILY_REMINDER_SMS_MAX_CHARS) errors.push(`Keep it under ${DAILY_REMINDER_SMS_MAX_CHARS} characters.`);
  const unknown = Array.from(t.matchAll(/\{\{\s*(\w+)\s*\}\}/g))
    .map(m => m[1])
    .filter(n => !["displayName", "todayUrl", "settingsUrl"].includes(n));
  if (unknown.length) errors.push(`Unknown variable: ${Array.from(new Set(unknown)).map(n => `{{${n}}}`).join(", ")}`);
  return errors;
}

// GSM-7 basic character set (1 unit each) and extension table (2 units each: escape + char).
const GSM_BASIC =
  "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
const GSM_EXT = "^{}\\[~]|€\f";

export type SmsSegmentInfo = {
  encoding: "GSM-7" | "Unicode";
  characters: number;
  segments: number;
  perSegment: number;
  /** Characters that force Unicode encoding (deduplicated, in order of appearance). */
  nonGsmChars: string[];
};

export function smsSegmentInfo(text: string): SmsSegmentInfo {
  const chars = Array.from(text);
  const nonGsm: string[] = [];
  let gsmUnits = 0;
  for (const c of chars) {
    if (GSM_BASIC.includes(c)) gsmUnits += 1;
    else if (GSM_EXT.includes(c)) gsmUnits += 2;
    else if (!nonGsm.includes(c)) nonGsm.push(c);
  }
  if (nonGsm.length === 0) {
    const perSegment = gsmUnits <= 160 ? 160 : 153;
    return { encoding: "GSM-7", characters: gsmUnits, segments: Math.max(1, Math.ceil(gsmUnits / perSegment)), perSegment, nonGsmChars: [] };
  }
  // Unicode (UCS-2) counts UTF-16 code units; emoji take 2.
  const units = text.length;
  const perSegment = units <= 70 ? 70 : 67;
  return { encoding: "Unicode", characters: units, segments: Math.max(1, Math.ceil(units / perSegment)), perSegment, nonGsmChars: nonGsm };
}
