# Sweet Momentum — Roadmap & Enhancement Log

_Last updated: August 10, 2026_

This document tracks what's shipped, what's in progress, and what's planned for the Sweet Momentum app (sweetmo.io) and its companion book. Keep it updated whenever a feature is discussed or shipped so context isn't lost between sessions.

---

## Status Snapshot

- **Live at**: sweetmo.io (hosted on Render)
- **Repo**: [digimac/pacetracker](https://github.com/digimac/pacetracker)
- **Last shipped commit**: `8784337` — "This Summer, get sweet." promo banner (Aug 2026)

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
- **6-month rolling free Pro trial** — every new signup gets full Pro access free for 6 months from their join date (rolling, per-user). Existing users were backdated to a fresh 6-month trial from launch day. Paid subscribers are unaffected. Trial countdown banner shown on Dashboard, Settings, and Subscribe page. Admin can send a day-45-before-expiry reminder email (test or bulk) from the Emails tab, with an editable template ("Trial Ending Reminder"). Admin member list shows trial status and days remaining.

**Marketing pages**
- `/start` — public marketing landing page
- `/communities` — 8-category showcase with lateral scroll
- `/reasons` — typographic collage page
- `/story` — generic "Why Momentum" philosophy page (admin-editable)
- `/book` — book companion landing page (hero, 6-metrics breakdown, personalized app screens, Free vs Pro pricing, Chapter 1 email-gated download)

**Compliance/infra**
- Terms, Privacy Policy, EULA pages
- Google Analytics, sitemap submitted to Search Console
- ADA quick-fix pass
- Cloudinary for image uploads

---

## In Progress

- [ ] **Verify Twilio SMS is live** — phone number authentication status was unconfirmed as of last check-in; confirm reminders/welcome texts are actually sending in production.
- [ ] **Chapter 1 PDF hookup** — `/book` page currently gates an email placeholder ("early access, PDF at launch"). Once the real PDF exists, wire it to Cloudinary and send it directly instead of the placeholder message.
- [ ] **Fix stale book launch date** — `/book` banner still says "Available June 2026," which has passed. Needs a real date or generic "Coming Soon."

---

## Planned / Backlog

- [ ] **Personal founder story page** — a dedicated page telling Kevin's personal origin story of why Sweet Momentum was built (the nostalgia/candy/daily-devotion narrative that anchors the book's Chapter 1), distinct from the existing generic `/story` philosophy page. Needs a route decision (e.g. `/founder` or `/origin`) and whether it links from `/book`, `/start`, or both.
- [ ] Warehouse "content lab" initiatives (from May 2026 discussion): signup-focused short ad videos (3–5), 1–2 longer brand videos, onboarding/UI footage library, guided-audio clips tied to Weekly/Monthly/Quarterly framing
- [ ] Reduce signup friction: personalized onboarding questions, contextual tooltips, embedded instructional clips
- [ ] Decide primary acquisition channel to build content around (paid social vs. organic vs. email)
- [ ] **Candy icon per core metric** — associate a distinct candy icon/illustration with each of the 6 core metrics (TIME, GOAL, TEAM, TASK, VIEW, PACE), tying the UI visually to the book's nostalgia/candy-as-reward theme. Needs icon set sourced or commissioned, then wired into the metric rows on Today, Dashboard, History, and admin metrics config.

---

## Notes

- Space description previously tracked roadmap context but was cleared — this file is now the source of truth going forward.
