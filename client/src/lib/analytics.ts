/**
 * Google Analytics (GA4, G-6NZEK6QG6W, loaded in client/index.html) events for
 * measuring Simple mode. The server decides the facts (new day, first score, week-2
 * return) and this module just forwards them, so events can't double-fire.
 *
 * Events
 *   sign_up       { method, app_mode, invited }
 *   score_day     once per member per scored day (first Win/Loss tap or first Save)
 *   first_score   once per member: their first ever scored day
 *   retained_d7   once per member: first scored day in days 7–13 after signup
 *   score_saved   every Save press: { metrics_rated, day_total, day_quality }
 * User properties (for comparing cohorts)
 *   app_mode, signup_app_mode ("simple" | "full" | "pre_simple"), signup_week ("2026-W43")
 *
 * Privacy: GA gets the internal numeric user id only (no email or name). The admin
 * account sends no events. Nothing is sent from dev builds.
 *
 * Meta Pixel (1420020006532502, loaded in client/index.html and the public pages)
 * gets the same moments as standard/custom events, with no user id, email, or name:
 *   sign_up      → CompleteRegistration + StartTrial (every new account starts the 6-month Pro trial)
 *   first_score  → trackCustom FirstScore
 *   retained_d7  → trackCustom RetainedD7
 *   paid upgrade → Subscribe (from the billing success page, once per checkout)
 *   PageView fires on load and on every /# route change (see index.html).
 *
 * Debug: run localStorage.setItem("sm_ga_debug","1") in the browser console, then
 * reload. Events show up in GA → Admin → DebugView.
 */
import { apiRequest } from "@/lib/queryClient";

declare global {
  interface Window { gtag?: (...args: any[]) => void; fbq?: (...args: any[]) => void }
}

export type ScoreAnalytics = {
  newDay: boolean;
  appMode: "simple" | "full";
  signupAppMode: string;
  daysSinceSignup: number;
  isToday: boolean;
  totalDaysScored: number;
  daysScoredLast7: number;
  isFirstScore: boolean;
  retainedD7: boolean;
};

let internalUser = false;
let identifiedId: string | null = null;
let resolveReady: () => void = () => {};
let ready = new Promise<void>(r => { resolveReady = r; });

const debug = () => { try { return localStorage.getItem("sm_ga_debug") === "1"; } catch { return false; } };
const canSendMeta = () => typeof window !== "undefined" && typeof window.fbq === "function" && (import.meta.env.PROD || debug());

/** GA event name → Meta Pixel event. Anything not listed stays GA-only. */
const META_EVENTS: Record<string, { std?: string[]; custom?: string }> = {
  sign_up: { std: ["CompleteRegistration", "StartTrial"] },
  first_score: { custom: "FirstScore" },
  retained_d7: { custom: "RetainedD7" },
};

function sendMeta(name: string, params: Record<string, string | number>) {
  if (!canSendMeta() || internalUser) return;
  try {
    const m = META_EVENTS[name];
    if (!m) return;
    m.std?.forEach(ev => window.fbq!("track", ev, params));
    if (m.custom) window.fbq!("trackCustom", m.custom, params);
  } catch { /* never break the app */ }
}

/** Paid upgrade finished (Stripe redirected back). Fires once per checkout session. */
export async function trackSubscribe(plan: string | null) {
  await Promise.race([ready, new Promise(r => setTimeout(r, 3000))]);
  if (!plan || plan === "free" || !canSendMeta() || internalUser) return;
  try {
    const sid = new URLSearchParams(window.location.hash.split("?")[1] || "").get("session_id") || plan;
    const key = `sm_meta_sub_${sid}`;
    if (sessionStorage.getItem(key)) return;
    sessionStorage.setItem(key, "1");
    window.fbq!("track", "Subscribe", { content_name: plan });
  } catch { /* never break the app */ }
}

const canSend = () => typeof window !== "undefined" && typeof window.gtag === "function" && (import.meta.env.PROD || debug());

/** Call when a member is known (login, signup, page load with a session). */
export async function identifyAnalytics(userId: number) {
  if (identifiedId === String(userId)) return;
  try {
    const ctx = await apiRequest("GET", "/api/analytics/context").then(r => r.json());
    identifiedId = String(userId);
    internalUser = !!ctx?.isInternal;
    if (ctx && canSend() && !internalUser) {
      window.gtag!("set", { user_id: ctx.userId });
      window.gtag!("set", "user_properties", {
        app_mode: ctx.appMode,
        signup_app_mode: ctx.signupAppMode,
        signup_week: ctx.signupWeek,
      });
    }
  } catch {
    /* analytics must never break the app */
  } finally {
    resolveReady();
  }
}

/** Call on logout so the next member on this device isn't attributed to the last one. */
export function resetAnalytics() {
  identifiedId = null;
  internalUser = false;
  ready = new Promise<void>(r => { resolveReady = r; });
  if (canSend()) window.gtag!("set", { user_id: null });
}

export async function track(name: string, params: Record<string, string | number> = {}) {
  // Wait (briefly) for identity so the event carries user_id + user properties.
  await Promise.race([ready, new Promise(r => setTimeout(r, 3000))]);
  sendMeta(name, params);
  if (!canSend() || internalUser) return;
  window.gtag!("event", name, debug() ? { ...params, debug_mode: true } : params);
}

/** Forward the server's facts after any score write. `source`: tap | save | history. */
export function trackScore(a: ScoreAnalytics | null | undefined, source: "tap" | "save" | "history") {
  if (!a || !a.newDay) return;
  const base = { app_mode: a.appMode, signup_app_mode: a.signupAppMode, days_since_signup: a.daysSinceSignup };
  track("score_day", {
    ...base,
    source,
    is_today: a.isToday ? "true" : "false",
    total_days_scored: a.totalDaysScored,
    days_scored_last_7: a.daysScoredLast7,
  });
  if (a.isFirstScore) track("first_score", { ...base, same_day_as_signup: a.daysSinceSignup === 0 ? "true" : "false" });
  if (a.retainedD7) track("retained_d7", base);
}
