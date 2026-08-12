# Sweet Momentum — Roadmap & Enhancement Log

_Last updated: August 12, 2026 (Twilio A2P 10DLC CTA rejection diagnosed and fixed)_

This document tracks what's shipped, what's in progress, and what's planned for the Sweet Momentum app (sweetmo.io) and its companion book. Keep it updated whenever a feature is discussed or shipped so context isn't lost between sessions.

---

## Status Snapshot

- **Live at**: sweetmo.io (hosted on Render)
- **Repo**: [digimac/pacetracker](https://github.com/digimac/pacetracker)
- **Last shipped commit**: `8da1db9` — add SMS/A2P 10DLC required disclosures for Twilio campaign resubmission

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
  - [ ] Resubmit the campaign in Twilio Console → Messaging → Regulatory Compliance with a corrected `message_flow` field describing both opt-in paths, e.g.: "End users opt in by (1) providing their mobile number during account registration at sweetmo.io/#/register and tapping 'Yes, enable SMS notifications' on the consent screen, or (2) visiting sweetmo.io/#/settings and checking the 'Receive SMS reminders and notifications' box. Message types include daily score reminders, a one-time welcome message, and momentum partner activity alerts. Message frequency varies (typically 0-7 messages per week). Message and data rates may apply. Reply HELP for help, STOP to cancel. Terms and Conditions: sweetmo.io/terms. Privacy Policy: sweetmo.io/privacy (mobile numbers are not shared with third parties)."
  - [ ] Ensure sample messages in the campaign match the actual message bodies in `sms.ts` verbatim (brand name + STOP language included)
  - [ ] Wait for carrier approval (can take anywhere from same-day to ~1–2 weeks depending on campaign type and vetting)
  - [ ] Once approved, send a real test via admin "Send Test SMS" and confirm delivery to an actual phone
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
