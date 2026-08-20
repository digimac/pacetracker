# Sweet Momentum — Roadmap & Enhancement Log

_Last updated: August 20, 2026 (removed summer promo banner)_

This document tracks what's shipped, what's in progress, and what's planned for the Sweet Momentum app (sweetmo.io) and its companion book. Keep it updated whenever a feature is discussed or shipped so context isn't lost between sessions.

---

## Status Snapshot

- **Live at**: sweetmo.io (hosted on Render)
- **Repo**: [digimac/pacetracker](https://github.com/digimac/pacetracker)
- **Last shipped commit**: `33b5f80` — remove summer promo banner from Subscribe page
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
- Twilio SMS: opt-in, daily score reminders, welcome text
- **6-month rolling free Pro trial** — every new signup gets full Pro access free for 6 months from their join date (rolling, per-user). Existing users were backdated to a fresh 6-month trial from launch day. Paid subscribers are unaffected. Trial countdown banner shown on Dashboard, Settings, and Subscribe page. Admin can send a day-45-before-expiry reminder email (test or bulk) from the Emails tab, with an editable template ("Trial Ending Reminder"). Admin member list shows trial status and days remaining. Test send confirmed working end-to-end (Aug 11, 2026).
- **SMTP diagnostics** — admin Emails tab has a "Check SMTP Connection" button that runs a live `transporter.verify()` against the mail server (no email sent) and reports configured/verified/error state distinctly. Fixed a bug where `sendPasswordResetEmail` had no try/catch (unlike every other send function). Password reset delivery confirmed working (Aug 11, 2026).
- **Twilio diagnostics** — admin SMS section has a "Check Twilio Connection" button that authenticates against the Twilio API and confirms the from-number is SMS-capable, without sending a message or incurring cost. Distinguishes missing env vars, bad credentials, number not found, and number not SMS-capable. Test-SMS route now surfaces the real Twilio error message instead of a bare pass/fail (Aug 11, 2026).
- **Twilio A2P 10DLC campaign approved** (Aug 18, 2026) — the full SMS compliance saga is closed out. Timeline: 3 rejections (error 30909, then 30924 twice) traced to, in order, missing SMS disclosures on Privacy/Terms, split-up consent language, and finally an unreachable consent screen plus a declared-but-nonfunctional keyword opt-in flow. Fixes shipped: SMS disclosures on `/privacy` and `/terms` (`8da1db9`), unified consent block on `register.tsx`/`settings.tsx` (`6f8b24a`), standalone public `/sms-terms` verification page (`67f9e06`), a real inbound SMS webhook handling JOIN/START/STOP/HELP keywords (`f20a3b7`), and a delivery status callback with plain-English Twilio error logging in admin → SMS (`28c0f7b`). Campaign is now carrier-approved, and **live re-test confirmed working** (Aug 20, 2026): texting HELP from a real phone gets an immediate auto-reply, confirming outbound delivery is fully unblocked post-approval. SMS program is fully operational end-to-end.
- **Candy icons per core metric** — admin can upload a small candy icon per metric (TIME, GOAL, TEAM, TASK, VIEW, PACE) via Cloudinary in the Metrics tab. Shows next to the metric label on the Today page's scoring card when set; falls back gracefully (no icon) otherwise. Ties the UI to the book's nostalgia/candy theme (Aug 15, 2026).

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
- [ ] Populate `/book/resources` with real content — page and admin manager are live but empty; add the actual illustrations/charts from the book and any downloadable resources via Admin → Resources

---

## Notes

- Space description previously tracked roadmap context but was cleared — this file is now the source of truth going forward.
