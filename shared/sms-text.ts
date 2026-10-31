/**
 * Daily reminder SMS text: default wording, variable filling, compliance checks, and
 * segment counting. Shared by the server (send + save validation) and the Admin editor
 * (live preview), so both always agree.
 */

export const DAILY_REMINDER_SMS_KEY = "sms_daily_reminder";

/** Used whenever no custom text has been saved in Admin. Original wording, greeting by first name. */
export const DEFAULT_DAILY_REMINDER_SMS =
  "Sweet Momentum: Good morning {{firstName}}, time to score your day → {{todayUrl}}\nReply STOP to unsubscribe.";

export const DAILY_REMINDER_SMS_VARIABLES = [
  { token: "{{firstName}}", name: "firstName", description: "First name (first word of the name if no first name is saved)" },
  { token: "{{displayName}}", name: "displayName", description: "Full name as shown in the app" },
  { token: "{{yesterdayScore}}", name: "yesterdayScore", description: "Yesterday's net score, e.g. +4 (\"no score\" if not scored)" },
  { token: "{{lastScore}}", name: "lastScore", description: "Net score on the last day they scored, e.g. +4 (\"no score\" if never)" },
  { token: "{{lastScoredDate}}", name: "lastScoredDate", description: "Last day they scored, e.g. Oct 30 (\"never\" if never)" },
  { token: "{{todayUrl}}", name: "todayUrl", description: "Link to Today" },
  { token: "{{settingsUrl}}", name: "settingsUrl", description: "Link to Settings (reminder time/method)" },
] as const;

export type DailyReminderSmsVars = {
  firstName: string;
  displayName: string;
  yesterdayScore: string;
  lastScore: string;
  lastScoredDate: string;
  todayUrl: string;
  settingsUrl: string;
};

const VAR_NAMES: Record<string, keyof DailyReminderSmsVars> = Object.fromEntries(
  DAILY_REMINDER_SMS_VARIABLES.map(v => [v.name.toLowerCase(), v.name as keyof DailyReminderSmsVars]),
);

export const DAILY_REMINDER_SMS_MAX_CHARS = 480;

/** Fills {{variables}}. Names are case-insensitive, so {{displayname}} and {{FirstName}} work too. */
export function renderDailyReminderSms(template: string, vars: DailyReminderSmsVars): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (whole, name: string) => {
    const key = VAR_NAMES[name.toLowerCase()];
    return key ? vars[key] : whole;
  });
}

/** Net score formatted for a text: +4, 0, -2. */
export function formatNetScore(n: number): string {
  return n > 0 ? `+${n}` : String(n);
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
    .filter(n => !VAR_NAMES[n.toLowerCase()]);
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
