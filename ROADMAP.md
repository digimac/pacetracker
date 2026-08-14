# Sweet Momentum — Roadmap & Enhancement Log

_Last updated: August 14, 2026 (A2P 10DLC: root cause found — keyword opt-in webhook built)_

This document tracks what's shipped, what's in progress, and what's planned for the Sweet Momentum app (sweetmo.io) and its companion book. Keep it updated whenever a feature is discussed or shipped so context isn't lost between sessions.

---

## Status Snapshot

- **Live at**: sweetmo.io (hosted on Render)
- **Repo**: [digimac/pacetracker](https://github.com/digimac/pacetracker)
- **Last shipped commit**: `f20a3b7` — add working keyword opt-in/opt-out/help SMS webhook (JOIN/STOP/HELP)

---

## Shipped

**Core app**
- Daily scoring across 6 metrics (TIME, GOAL, TEAM, TASK, VIEW, PACE) — WIN/LOSS/SKIP, plus up to 4 custom metrics for Pro
- Momentum Dashboard (last-7-days view, sparklines, activity timeline)
- History page with calendar view, per-day sparkline recap, Goal History
- Daily notes ("Today's notes for tomorrow's goal")

**Accounts & access**
- Full user database, email/password auth, forgot/reset password (SMTP.com)
- Profile: first/last name, phone (SMS opt-in), timezone, general location
- Admin dashboard: metrics config, page content, member management, email templates, SEO
- 8 community category pages (athletes, graduates, recovery, veterans, caregivers, entrepreneurs, writers, musicians)

**Social / Pro features**
- Momentum Partners (invite, accept, two-way visibility, two-step unlink)
- Momentum Network (org-chart diagram)
- Momentum Groups (create, moderate, invite) — Pro/Group tier
- Score Map (global dot map, orange highlight for 7+ scores)
- Zoom coaching session requests (Pro only)

**Billing & growth**
- Stripe subscriptions: Pro ($4.99/mo, $59/yr), Group ($49/mo, $549/yr)
- "This Summer, get sweet." promo banner on Subscribe page (May–Aug 2026)
- HubSpot 1-way CRM sync
- Twilio SMS: opt-in, daily score reminders, welcome text
- **6-month rolling free Pro trial** — every new signup gets full Pro access free for 6 months from their join date (rolling, per-user). Existing users were backdated to a fresh 6-month trial from launch day. Paid subscribers are unaffected. Trial countdown banner shown on Dashboard, Settings, and Subscribe page. Admin can send a day-45-before-expiry reminder email (test or bulk) from the Emails tab, with an editable template ("Trial Ending Reminder"). Admin member list shows trial status and days remaining. Test send confirmed working end-to-end (Aug 11, 2026).
- **SMTP diagnostics** — admin Emails tab has a "Check SMTP Connection" button that runs a live `transporter.verify()` against the mail server (no email sent) and reports configured/verified/error state distinctly. Fixed a bug where `sendPasswordResetEmail` had no try/catch (unlike every other send function). Password reset delivery confirmed working (Aug 11, 2026).
- **Twilio diagnostics** — admin SMS section has a "Check Twilio Connection" button that authenticates against the Twilio API and confirms the from-number is SMS-capable, without sending a message or incurring cost. Distinguishes missing env vars, bad credentials, number not found, and number not SMS-capable. Test-SMS route now surfaces the real Twilio error message instead of a bare pass/fail (Aug 11, 2026).

**Marketing pages**
- `/start` — public marketing landing page
- `/communities` — 8-category showcase with lateral scroll
- `/reasons` — typographic collage page
- `/story` — generic "Why Momentum" philosophy page (admin-editable)
- `/book` — book companion landing page (hero, 6-metrics breakdown, personalized app screens, Free vs Pro pricing, Chapter 1 email-gated download)
- `/stuck` — founder origin story page template (hero image banner, admin-uploadable via Cloudinary in Admin → Pages → Founder's Story Page; 5 structured story sections + timeline, all placeholder text pending Kevin's actual story). Linked from `/book` and `/start` nav/footer.

**Compliance/infra**
- Terms, Privacy Policy, EULA pages
- Google Analytics, sitemap submitted to Search Console
- ADA quick-fix pass
- Cloudinary for image uploads

---

## In Progress

- [ ] **Get Twilio SMS fully live — A2P 10DLC registration** — first campaign submission was rejected with Twilio error 30909 ("issues verifying the Call to Action"), meaning TCR reviewers could not verify the opt-in/consent flow from a public URL. Root cause found and fixed in code (Aug 12, 2026): the live Privacy Policy and Terms pages had zero SMS-specific disclosures (no mobile-number-not-shared statement, no message frequency, no rates disclosure), and the opt-in screens (register.tsx SMS step, settings.tsx SMS toggle) didn't link to those policies. All of that is now shipped (commit `8da1db9`). Remaining steps (done in the Twilio Console, not in code):
  - [ ] Confirm `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_FROM_NUMBER` are set on Render, then run "Check Twilio Connection" in admin to confirm the account authenticates and the number is SMS-capable
  - [ ] Verify sweetmo.io/privacy and sweetmo.io/terms are live with the new SMS disclosures (check admin → Pages → Privacy Policy / Terms & Conditions — if custom content was set there instead of the default, add the same SMS language manually in the admin editor, since custom content overrides the code default)
  - [x] Resubmitted the campaign with a corrected `message_flow` field describing both opt-in paths, sample messages, frequency, rates disclosure, and Terms/Privacy links (Aug 12, 2026, ~9:10am) — rejected again
  - [x] **Second rejection: Twilio error 30924** ("Missing or non-compliant consent agreement language") — the message type, frequency, rates, and opt-out instructions were split across two visually separate blocks on the opt-in screens instead of one unified statement immediately adjacent to the consent control, which is a hard TCPA/CTIA requirement. Fixed (Aug 12, 2026, commit `6f8b24a`): both `register.tsx` (SMS opt-in screen) and `settings.tsx` (SMS toggle) now show a single boxed consent statement combining message type + frequency + rates + opt-out + "consent not a condition of purchase" + Terms/Privacy links, directly beside the button/checkbox.
  - [x] Resubmitted with the consolidated consent language — **rejected again with the identical 30924 message** (Aug 14, 2026). Same wording twice in a row despite fixed language pointed to a *reachability* problem, not a *wording* problem: the actual consent screens sit behind a multi-step registration wizard (account + phone number entry) that TCR reviewers/crawlers generally won't complete, so the compliant language was effectively unverifiable to them.
  - [x] Built a standalone public verification page at **sweetmo.io/sms-terms** (no login/signup required) documenting the SMS program end-to-end: who sends messages, message types, frequency, cost, opt-out, and the exact verbatim consent text from both opt-in screens shown next to a mockup of the real button/checkbox. Linked from Terms & Privacy footers. (Aug 14, 2026, commit `67f9e06`)
  - [x] Resubmitted pointing `message_flow` at the `/sms-terms` page — **rejected a THIRD time, identical 30924 message** (Aug 14, 2026). Kevin shared the actual TCR campaign form field list, which revealed the real gap: the form has a dedicated **"List all opt-in keywords" / "What is the opt-in message?"** field set (separate from the free-text consent description), meaning the campaign registration declares a text-keyword opt-in path. The codebase had **zero inbound SMS handling** — nothing responded if a user texted the Twilio number — so the declared keyword flow was non-functional and unverifiable, explaining all three identical rejections regardless of website consent language quality.
  - [x] Built a real inbound SMS webhook (Aug 14, 2026, commit `f20a3b7`): `POST /api/sms/inbound` handles `JOIN/START/YES/SUBSCRIBE` (opts in + compliant confirmation reply), `STOP/STOPALL/UNSUBSCRIBE/CANCEL/END/QUIT` (opts out + confirmation), and `HELP/INFO` (support info reply). Matches inbound phone numbers to user accounts via new `storage.getUserByPhone()` and updates their `smsOptIn` flag. `/sms-terms` page updated with the exact auto-reply message text for all three keyword flows.
  - [x] Webhook configured in Twilio Console ("A Message Comes In" → `https://sweetmo.io/api/sms/inbound`, HTTP POST) and verified directly working via curl (returns 200 + correct TwiML reply). Texting JOIN/START from a real phone shows the inbound message logged in Twilio, but the auto-reply comes back **"Undelivered."** Since the webhook itself is confirmed functioning correctly, this is very likely Twilio's known A2P 10DLC outbound-blocking behavior (error 30034 family): inbound texts are received fine, but outbound replies from a 10DLC number without an approved campaign get silently blocked by carriers. This should self-resolve once the campaign is approved and the number is attached to it — not something further code can fix.
  - [ ] Fill in the campaign form's keyword fields to match the code exactly: **Opt-in keywords**: `JOIN, START, YES, SUBSCRIBE`. **Opt-in message**: "Sweet Momentum: You're subscribed to SMS alerts (daily score reminders, welcome message, momentum partner alerts). Msg frequency varies (typically 0-7/week). Msg & data rates may apply. Reply HELP for help, STOP to cancel." **Opt-out keywords**: `STOP, STOPALL, UNSUBSCRIBE, CANCEL, END, QUIT`. **Opt-out message**: "Sweet Momentum: You have been unsubscribed and will no longer receive SMS messages. Reply JOIN to resubscribe at any time." **Help keywords**: `HELP, INFO`. **Help message**: "Sweet Momentum: Daily score reminders, welcome text, and momentum partner alerts. Msg frequency varies. Msg & data rates may apply. Reply STOP to cancel. Support: track@sweetmo.io or sweetmo.io/sms-terms."
  - [ ] For "How do end-users consent to receive messages?": describe all three paths together — website registration, website settings, and text keyword — quoting the consent language for each and linking sweetmo.io/sms-terms, sweetmo.io/terms, sweetmo.io/privacy.
  - [ ] Once approved: verify the webhook is live first, then run a real test via admin "Send Test SMS" and confirm delivery. If rejected a fourth time, escalate directly to Twilio support with the campaign SID — at that point the evidence is as complete as it can be from the code side and a human review is warranted.
- [ ] **Chapter 1 PDF hookup** — `/book` page currently gates an email placeholder ("early access, PDF at launch"). Once the real PDF exists, wire it to Cloudinary and send it directly instead of the placeholder message.
- [ ] **Fix stale book launch date** — `/book` banner still says "Available June 2026," which has passed. Needs a real date or generic "Coming Soon."

---

## Planned / Backlog

- [ ] **Fill in the `/stuck` founder story content** — page template and hero image upload are shipped; still needs Kevin's actual story text dropped into the five placeholder sections (setup, turning point + pull quote, candy/nostalgia bridge, timeline milestones, mission) and a hero image uploaded via admin.
- [ ] Warehouse "content lab" initiatives (from May 2026 discussion): signup-focused short ad videos (3–5), 1–2 longer brand videos, onboarding/UI footage library, guided-audio clips tied to Weekly/Monthly/Quarterly framing
- [ ] Reduce signup friction: personalized onboarding questions, contextual tooltips, embedded instructional clips
- [ ] Decide primary acquisition channel to build content around (paid social vs. organic vs. email)
- [ ] **Candy icon per core metric** — associate a distinct candy icon/illustration with each of the 6 core metrics (TIME, GOAL, TEAM, TASK, VIEW, PACE), tying the UI visually to the book's nostalgia/candy-as-reward theme. Needs icon set sourced or commissioned, then wired into the metric rows on Today, Dashboard, History, and admin metrics config.

---

## Notes

- Space description previously tracked roadmap context but was cleared — this file is now the source of truth going forward.
