# Sweet Momentum — Roadmap & Enhancement Log

_Last updated: October 26, 2026 (activity timeline on Today)_

This document tracks what's shipped, what's in progress, and what's planned for the Sweet Momentum app (sweetmo.io) and its companion book. Keep it updated whenever a feature is discussed or shipped so context isn't lost between sessions.

---

## Status Snapshot

- **Live at**: sweetmo.io (hosted on Render)
- **Repo**: [digimac/pacetracker](https://github.com/digimac/pacetracker)
- **Last shipped commit**: `eb13bc4` — activity timeline on Today
- **Twilio SMS**: A2P 10DLC campaign approved Aug 18, 2026, live-tested and confirmed working Aug 20, 2026 (HELP keyword replies instantly)

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
- ~~"This Summer, get sweet." promo banner on Subscribe page~~ — removed Aug 20, 2026 (promo window ended)
- HubSpot 1-way CRM sync
- Twilio SMS: opt-in, welcome text (daily score reminders now run automatically, see below)
- **6-month rolling free Pro trial** — every new signup gets full Pro access free for 6 months from their join date (rolling, per-user). Existing users were backdated to a fresh 6-month trial from launch day. Paid subscribers are unaffected. Trial countdown banner shown on Dashboard, Settings, and Subscribe page. Admin can send a day-45-before-expiry reminder email (test or bulk) from the Emails tab, with an editable template ("Trial Ending Reminder"). Admin member list shows trial status and days remaining. Test send confirmed working end-to-end (Aug 11, 2026).
- **SMTP diagnostics** — admin Emails tab has a "Check SMTP Connection" button that runs a live `transporter.verify()` against the mail server (no email sent) and reports configured/verified/error state distinctly. Fixed a bug where `sendPasswordResetEmail` had no try/catch (unlike every other send function). Password reset delivery confirmed working (Aug 11, 2026).
- **Twilio diagnostics** — admin SMS section has a "Check Twilio Connection" button that authenticates against the Twilio API and confirms the from-number is SMS-capable, without sending a message or incurring cost. Distinguishes missing env vars, bad credentials, number not found, and number not SMS-capable. Test-SMS route now surfaces the real Twilio error message instead of a bare pass/fail (Aug 11, 2026).
- **Twilio A2P 10DLC campaign approved** (Aug 18, 2026) — the full SMS compliance saga is closed out. Timeline: 3 rejections (error 30909, then 30924 twice) traced to, in order, missing SMS disclosures on Privacy/Terms, split-up consent language, and finally an unreachable consent screen plus a declared-but-nonfunctional keyword opt-in flow. Fixes shipped: SMS disclosures on `/privacy` and `/terms` (`8da1db9`), unified consent block on `register.tsx`/`settings.tsx` (`6f8b24a`), standalone public `/sms-terms` verification page (`67f9e06`), a real inbound SMS webhook handling JOIN/START/STOP/HELP keywords (`f20a3b7`), and a delivery status callback with plain-English Twilio error logging in admin → SMS (`28c0f7b`). Campaign is now carrier-approved, and **live re-test confirmed working** (Aug 20, 2026): texting HELP from a real phone gets an immediate auto-reply, confirming outbound delivery is fully unblocked post-approval. SMS program is fully operational end-to-end.
- **Candy icons per core metric** — admin can upload a small candy icon per metric (TIME, GOAL, TEAM, TASK, VIEW, PACE) via Cloudinary in the Metrics tab. Shows next to the metric label on the Today page's scoring card when set; falls back gracefully (no icon) otherwise. Ties the UI to the book's nostalgia/candy theme (Aug 15, 2026).
- **Dashboard "Day Quality" tiered breakdown** (Sep 2, 2026) — replaced the misleading "Win Rate" stat, which counted any day with a net score above zero as a "win" (so 1 net point out of 6 metrics looked identical to a perfect day). New Day Quality card splits days into Strong (total ≥ 4), Solid (1–3), and Off (≤ 0), shown as a 3-segment bar plus per-tier counts/percentages. The top-line stat-grid card was renamed "Net Positive" / "days above even" so it no longer implies more than it measures.
- **Automatic daily scoring reminder** (Oct 8, 2026, `cd57917`) — every member gets one reminder a day to score, by default at **8:00 AM in their own local time** (adjustable in Settings). Rules:
  - Goes by the member's **preferred method only, email or SMS, never both**. No fallback: if SMS is preferred but the member isn't opted in (e.g. texted STOP), they get nothing that day.
  - **SMS only goes to opted-in members** with a phone on file. Settings won't let you switch to Text until SMS is on.
  - **Skips** members who already scored today (their local day), were already reminded today, turned reminders off, or have **no saved timezone**.
  - "Saved timezone" means actually chosen, not the `America/New_York` placeholder signup writes. New `timezone_confirmed` flag is set when the member saves Settings, or automatically from the browser's detected timezone the next time they open Dashboard/Today (never overrides a Settings choice). On rollout, existing members were marked confirmed only if their timezone wasn't the placeholder or they'd already set up SMS reminders. Everyone else is picked up the next time they open the app.
  - **Extended the existing job instead of duplicating it**: the old admin-only, SMS-only `/api/admin/send-scheduled-sms` checker (which never ran on its own) now delegates to `server/reminders.ts`, which also runs **in-process every 5 minutes** in production. A reminder is due from its time until 60 minutes after, so a late tick or quick restart doesn't drop it, but a long outage won't send an 8 AM nudge in the afternoon. Members who'd turned on the old SMS reminder were carried over to SMS at their chosen time. The old `sms_reminder_*` columns are kept but no longer read.
  - **Send log**: new `reminder_log` table (one row per attempt: channel, masked destination, sent/failed, error, Twilio SID). A unique index on (user, kind, local date) means a member can't be reminded twice in a day, even across restarts or multiple instances. Failed sends aren't retried.
  - **Settings → Daily Schedule → Daily Score Reminder**: on/off, preferred method (Email / Text message), reminder time (Default 08:00 / wake time / work start shortcuts).
  - **Admin → Emails → Daily Score Reminders**: "Preview Who's Due" (dry run, sends nothing), "Run Now", a persisted send log, and a new editable **Daily Score Reminder** email template (`daily_reminder`, variables `{{displayName}}`, `{{settingsUrl}}`).
  - Env: `REMINDER_SCHEDULER=off` disables the scheduler (`on` enables it outside production). Email links use `APP_URL`, so make sure it's set to `https://sweetmo.io` on Render. Because the scheduler runs inside the web service, the service has to stay awake; Render free instances sleep when idle.
- **Simple mode** (Oct 22, 2026, `c48b759`) — one app-wide, reversible switch that trims Sweet Momentum to its core loop: get a reminder, score 6 metrics, see your streak. **On by default**; flip it in **Admin → Content → App Mode** (Simple / Full). Nothing is deleted, and turning it off restores every page and section immediately (members pick it up on their next page load). Stored in the new `app_settings` table (key `simple_mode`).
  - **Menu**: Today, History, Settings (plus Admin for the admin). Opening the app, logging in, and every hidden page (Dashboard, Score Map, Network, Groups, Story, Daily Tracking, Connect, Community) go to **Today**. Billing pages stay reachable (Stripe returns, trial banner) but aren't in the menu.
  - **Signup**: one step (name, email, password), then straight to Today. Phone, location, and category can be added later in Settings.
  - **Today**: the 6 metrics are the screen. One Save button (bottom); goal box and notes sit behind **"Add a note"** (auto-opens if today already has one); day counters, Momentum Partners, Groups, and the "add custom metrics" link are hidden. Existing custom metrics still show so nobody loses data. After saving, a **streak + Day Quality** card appears at the top with a "See history" button.
  - **History**: the Dashboard's **Day Quality** breakdown (last 30 days) now sits under the stats strip; Goal History is hidden.
  - **Settings**: Profile (name, mobile number, SMS opt-in), **Reminder & Timezone** (timezone + daily reminder). Location, community, core/custom metrics, wake/sleep/work times, daily goal statement, day counters, goal list, and connections are hidden.
  - Day Quality thresholds (Sweet 6+, Strong 4–5, Solid 1–3, Off ≤0) now live in one shared helper used by Dashboard, History, and Today.
  - Also fixed: on narrow phones the metric-card badges ran under the Win button; they now wrap, and the redundant SUCCESS/SETBACK badge hides below tablet width.
- **GA events to measure Simple mode** (Oct 23, 2026, `2ba717c`) — GA4 property `G-6NZEK6QG6W` now gets custom events, so Simple-mode signups can be compared with earlier ones.
  - **Events**: `sign_up` (method, app_mode, invited); `score_day` (**once per member per scored day**, on the first Win/Loss tap or first Save: days_since_signup, is_today, total_days_scored, days_scored_last_7, source tap/save/history); `first_score` (once per member, same_day_as_signup); `retained_d7` (once per member, first scored day 7–13 days after signup); `score_saved` (every Save: metrics_rated, day_total, day_quality).
  - **User properties**: `app_mode`, `signup_app_mode` (`simple` / `full` / `pre_simple` for everyone who joined before Oct 22), `signup_week` (e.g. `2026-W43`). GA `user_id` is the internal numeric id, never email or name.
  - The **server decides the facts** (it has full history + the member's timezone) and the browser only forwards them. A new `daily_entries.analytics_counted_at` marker is claimed atomically, so re-saves, extra taps, other tabs, and other devices never double-count. All days that existed before this release were marked as already counted. New `users.signup_app_mode` records the mode at signup.
  - No events from the admin account or dev builds. To check events live: in the browser console run `localStorage.setItem("sm_ga_debug","1")`, reload, then watch GA → Admin → DebugView.
  - GA caveat: ad blockers and privacy browsers drop some events, so treat GA as directional; the database is the source of truth for exact counts.
- **"Sweet" Day Quality tier** (Oct 23, 2026) — new top tier for days with a net score of +6 or more. Tiers are now Sweet (6+), Strong (4–5), Solid (1–3), Off (≤0). Shown in lime on Today's summary and as a fourth segment on the History/Dashboard Day Quality card (2×2 grid on mobile, 4 across on desktop). GA `day_quality` can now also be `sweet`. With the 6 core metrics, Sweet means a perfect day.
- **Past days locked** (Oct 23, 2026) — a day can only be scored or changed on that day itself, in the member's saved timezone. The server rejects writes to any other date (both Save and single-tap endpoints) with `403` / `DAY_LOCKED`, so past days can't be edited or back-filled and future days can't be pre-scored. History's day drawer is read-only for past days (labelled "Past Day · Locked", rating buttons disabled, notes shown read-only, no Save button, lock notice); today's drawer is still editable. Today re-checks the date every minute so a page left open past midnight rolls to the new day instead of writing to the locked one. Logic in `server/day-lock.ts`.
- **Admin account receives daily reminders** (Oct 24, 2026) — removed the `admin_account` skip from the daily reminder job so track@sweetmo.io gets its reminder like any member (SMS at 8:00 AM Eastern), letting the owner verify reminders end to end. Admin is still excluded from Google Analytics. Diagnosis that led here: production scheduler runs fine on the Starter plan, but the admin account was the only one set up for SMS, 22 of 24 accounts are skipped as `no_timezone` (never opened the app since reminders shipped; left as-is by decision), and email has failed since Oct 23 with SMTP `535 Invalid login`.
- **Admin editor for the daily reminder text** (Oct 25, 2026) — Admin → Emails → Daily Score Reminders now has a "Daily Reminder Text (SMS)" card. Edit the wording with `{{displayName}}`, `{{todayUrl}}`, `{{settingsUrl}}` (click-to-insert), see a live preview with a character count and how many texts each send bills as, get a warning for characters that force Unicode (e.g. the default text's "→" makes it 2 texts), send a test to your own phone, or reset to the default. Saving requires "Sweet Momentum" and STOP wording (promised in /sms-terms) and no unknown variables, checked in the browser and on the server. Stored in `app_settings` (`sms_daily_reminder`; empty = default); shared logic in `shared/sms-text.ts`. Default wording unchanged until edited.
- **Activity timeline on Today** (Oct 26, 2026) — the dot timeline ("Today's Activity Timeline") now shows on Today, between the score/summary and Core Metrics, in both Simple and Full mode, as a quick view of the day's scoring. Hidden until the first Win/Loss tap so a fresh day goes straight to the buttons; updates on every tap and Save. Extracted into a shared `TodayTimelineCard` (also used by the Dashboard, unchanged there, including the Admin background image). Fixes to the shared `DaySparkline`: it now draws at the container's real width, so on phones dots and time labels stay full size instead of shrinking to about half, and the stem lines no longer block taps on stacked dots.

**Marketing pages**
- `/start` — public marketing landing page
- `/communities` — 8-category showcase with lateral scroll
- `/reasons` — typographic collage page
- `/story` — generic "Why Momentum" philosophy page (admin-editable)
- `/book` — book companion landing page (hero, 6-metrics breakdown, personalized app screens, Free vs Pro pricing, Chapter 1 email-gated download)
- `/stuck` — founder origin story page template (hero image banner, admin-uploadable via Cloudinary in Admin → Pages → Founder's Story Page; 5 structured story sections + timeline, all placeholder text pending Kevin's actual story). Linked from `/book` and `/start` nav/footer.
- `/metrics/:key` (time, goal, team, task, view, pace) — standalone editorial pages for each core metric: candy icon, short story, pull quote, CTA to buy the book or get the app. No daily score data shown, by design — these explain what each metric *means*, not how you're performing. One shared template pulls live content from the admin-editable Metrics tab; a metric switcher strip lets visitors jump between all 6. Linked from the in-app metric info modal ("Read more about X →"). All 6 URLs in sitemap.xml.
- `/book/resources` — gallery of book illustrations/charts and downloadable resources, nested under `/book`. Admin-managed via a new "Resources" tab (add/reorder/delete, upload image + optional download file per item via Cloudinary). Kind filter (Illustration vs Download) auto-appears once both types exist. Linked from `/book` nav and an in-page teaser card; breadcrumb back to `/book`. Empty state shown until Kevin uploads the first resources.

**Compliance/infra**
- Terms, Privacy Policy, EULA pages
- Google Analytics, sitemap submitted to Search Console
- Informal accessibility touch-ups (alt text added on marketing pages) — no formal WCAG/ADA audit performed, no compliance verified. Do not represent the site as ADA-compliant or display a compliance badge until a real audit (automated scan + manual keyboard/screen-reader review) has been done.
- Cloudinary for image uploads
- **Site-wide subnav bar** (Sep 2, 2026) — the required "Created with Perplexity Computer" attribution can't be removed (it's a platform notice, not optional branding), so instead added a consistent pill-style subnav directly above the footer on every public page (`/start`, `/communities`, `/reasons`, `/book`, `/stuck`, `/book/resources`, `/metrics/:key`, `/sms-terms`) linking to all main site sections with the current page highlighted. Also fixed 3 pages (`book-resources.html`, `metrics.html`, `sms-terms.html`) that were missing the attribution line entirely — now present site-wide. Logged-in Dashboard also got an equivalent site-links row above its attribution line, separate from the primary in-app sidebar nav.

---

## In Progress

- [ ] **Chapter 1 PDF hookup** — `/book` page currently gates an email placeholder ("early access, PDF at launch"). Once the real PDF exists, wire it to Cloudinary and send it directly instead of the placeholder message.
- [ ] **Fix stale book launch date** — `/book` banner still says "Available June 2026," which has passed. Needs a real date or generic "Coming Soon."

---

## Planned / Backlog

- [ ] **Fill in the `/stuck` founder story content** — page template and hero image upload are shipped; still needs Kevin's actual story text dropped into the five placeholder sections (setup, turning point + pull quote, candy/nostalgia bridge, timeline milestones, mission) and a hero image uploaded via admin.
- [ ] Warehouse "content lab" initiatives (from May 2026 discussion): signup-focused short ad videos (3–5), 1–2 longer brand videos, onboarding/UI footage library, guided-audio clips tied to Weekly/Monthly/Quarterly framing
- [ ] Reduce signup friction: personalized onboarding questions, contextual tooltips, embedded instructional clips
- [ ] Decide primary acquisition channel to build content around (paid social vs. organic vs. email)
- [ ] Wire the candy icon into Dashboard and History views too (currently only shows on the Today page's MetricCard — Kevin is sourcing the actual icon artwork to upload via admin)
- [ ] **Fix email delivery (Kevin, Monday)**: since Oct 23 every outgoing email (reminders, password resets, welcome) fails with SMTP `535 5.7.8 Invalid login`. Check the SMTP.com account, issue a new key/password, and update `SMTP_PASS` on the Render service.
- [ ] **GA setup for Simple-mode reporting (Kevin, in GA Admin)**: register custom definitions (user-scoped `app_mode`, `signup_app_mode`, `signup_week`; event-scoped `source`, `is_today`, `day_quality`, `same_day_as_signup`; custom metrics `days_since_signup`, `days_scored_last_7`, `total_days_scored`, `metrics_rated`, `day_total`), mark `sign_up`, `first_score`, `retained_d7` as key events, then build the three explorations (first-day score rate, 7-day return, days scored per week) split by `signup_app_mode`. Give it 2–4 weeks of signups before judging.
- [ ] **Daily reminder follow-ups**: (1) optional second reminder later in the day (log already supports a separate `kind`); (2) one-click unsubscribe link in reminder emails (they currently link to Settings); (3) confirm `APP_URL` on Render and verify the first real 8 AM sends in Admin → Emails → Reminder Send Log
- [ ] Populate `/book/resources` with real content — page and admin manager are live but empty; add the actual illustrations/charts from the book and any downloadable resources via Admin → Resources

---

## Notes

- Space description previously tracked roadmap context but was cleared — this file is now the source of truth going forward.
