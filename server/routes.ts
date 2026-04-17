import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { stripe, createCheckoutSession, createBillingPortalSession, handleWebhook, PRICE_MONTHLY, PRICE_ANNUAL, PRICE_GROUP_MONTHLY, PRICE_GROUP_ANNUAL } from "./billing";
import { sendPasswordResetEmail, sendFeedbackEmail, sendInviteEmail, sendUpgradeEmail, sendCoachingRequestEmail, sendWelcomeEmail, sendWeeklyDigestEmail, sendReminderEmail, createTransporter } from "./email";
import { sendSms, sendDailyReminderSms, sendWelcomeSms } from "./sms";
import { hubspotSyncNewUser, hubspotSyncPlanChange, hubspotSyncDeleteUser } from "./hubspot";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { insertUserSchema, insertCustomMetricSchema, insertDailyEntrySchema, insertMetricScoreSchema, insertUserScheduleSchema, insertSitePageSchema } from "@shared/schema";
import { z } from "zod";
import { getCoordsForTimezone } from "./timezone-coords";
import { geocodeCity } from "./geocode";

// Admin email — the one account with full admin privileges
const ADMIN_EMAIL = "track@sweetmo.io";

async function requireAdmin(req: any, res: any, next: any) {
  if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
  const user = await storage.getUserById(req.session.userId);
  if (!user || user.email !== ADMIN_EMAIL) return res.status(403).json({ error: "Admin access required" });
  next();
}

// Session augmentation
declare module "express-session" {
  interface SessionData {
    userId?: number;
  }
}

function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  return `${hash}.${salt}`;
}

function verifyPassword(password: string, stored: string): boolean {
  const [hash, salt] = stored.split(".");
  const inputHash = scryptSync(password, salt, 64).toString("hex");
  return timingSafeEqual(Buffer.from(hash, "hex"), Buffer.from(inputHash, "hex"));
}

function requireAuth(req: any, res: any, next: any) {
  if (!req.session?.userId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

// Derive a unique username from an email address (local part, sanitised)
async function deriveUsername(email: string): Promise<string> {
  const base = email.split("@")[0].toLowerCase().replace(/[^a-z0-9_]/g, "").slice(0, 20) || "user";
  let candidate = base;
  let i = 2;
  while (await storage.getUserByUsername(candidate)) {
    candidate = `${base}${i++}`;
  }
  return candidate;
}

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  // Auth: Register
  app.post("/api/auth/register", async (req, res) => {
    try {
      // Accept body without username — derive it automatically from email
      const raw = z.object({
        email: z.string().email(),
        password: z.string().min(8),
        displayName: z.string().min(1),
      }).parse(req.body);
      const existingEmail = await storage.getUserByEmail(raw.email);
      if (existingEmail) return res.status(400).json({ error: "Email already registered" });
      const username = await deriveUsername(raw.email);
      const data = { ...raw, username };

      const user = await storage.createUser({ ...data, password: hashPassword(data.password) });
      req.session!.userId = user.id;

      // Create default schedule
      await storage.upsertUserSchedule({
        userId: user.id,
        wakeTime: "06:00",
        sleepTime: "22:00",
        workStartTime: "09:00",
        workEndTime: "17:00",
        timezone: "America/New_York",
        dailyGoal: "",
      });

      await new Promise<void>((resolve, reject) => req.session!.save(err => err ? reject(err) : resolve())).catch(() => {});
      // Sync to HubSpot (fire-and-forget)
      hubspotSyncNewUser(user, "America/New_York").catch(() => {});
      // Send welcome email (fire-and-forget)
      sendWelcomeEmail({ toEmail: user.email, displayName: user.displayName }).catch(() => {});
      res.json({ user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, firstName: user.firstName, lastName: user.lastName, city: user.city, region: user.region, country: user.country, category: user.category ?? null, phone: user.phone ?? null, smsOptIn: (user as any).smsOptIn ?? false } });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Registration failed" });
    }
  });

  // Auth: Login
  app.post("/api/auth/login", async (req, res) => {
    try {
      const { email, password } = z.object({ email: z.string(), password: z.string() }).parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user || !verifyPassword(password, user.password)) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      req.session!.userId = user.id;
      await new Promise<void>((resolve, reject) => req.session!.save(err => err ? reject(err) : resolve())).catch(() => {});
      res.json({ user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, firstName: user.firstName, lastName: user.lastName, city: user.city, region: user.region, country: user.country, category: user.category ?? null, phone: user.phone ?? null, smsOptIn: (user as any).smsOptIn ?? false } });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Login failed" });
    }
  });

  // Auth: Logout
  app.post("/api/auth/logout", (req, res) => {
    req.session!.destroy(() => res.json({ ok: true }));
  });

  // Auth: Forgot Password — request a reset link
  app.post("/api/auth/forgot-password", async (req, res) => {
    try {
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const user = await storage.getUserByEmail(email);
      // Always return 200 to prevent email enumeration
      if (!user) return res.json({ ok: true });

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour
      await storage.createPasswordResetToken(user.id, token, expiresAt);
      await sendPasswordResetEmail(user.email, token);

      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Auth: Reset Password — consume token and set new password
  app.post("/api/auth/reset-password", async (req, res) => {
    try {
      const { token, password } = z.object({
        token: z.string().min(1),
        password: z.string().min(8, "Password must be at least 8 characters"),
      }).parse(req.body);

      const record = await storage.getPasswordResetToken(token);
      if (!record) return res.status(400).json({ error: "Invalid or expired reset link" });
      if (record.usedAt) return res.status(400).json({ error: "This reset link has already been used" });
      if (new Date() > record.expiresAt) return res.status(400).json({ error: "This reset link has expired. Please request a new one." });

      const hashed = hashPassword(password);
      await storage.updateUserPassword(record.userId, hashed);
      await storage.markPasswordResetTokenUsed(record.id);

      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Feedback submission — sends email to track@sweetmo.io
  app.post("/api/feedback", requireAuth, async (req, res) => {
    const userId = req.session!.userId!;
    const user = await storage.getUserById(userId);
    if (!user) return res.status(401).json({ error: "Unauthorized" });

    // Validate first — return 400 only on bad input
    const schema = z.object({
      feedbackType: z.string().min(1, "Please enter a feedback type").max(200),
      summary:      z.string().min(10, "Summary must be at least 10 characters").max(3000),
      urgency:      z.enum(["Fun Idea", "Nice to Have", "Urgent Fix Needed"]),
    });
    let parsed: { feedbackType: string; summary: string; urgency: "Fun Idea" | "Nice to Have" | "Urgent Fix Needed" };
    try {
      parsed = schema.parse(req.body);
    } catch (e: any) {
      const msg = e?.errors?.[0]?.message || e.message || "Invalid input";
      return res.status(400).json({ error: msg });
    }

    // Send email — errors here are logged but don't fail the request
    const displayName = user.displayName || user.username;
    await sendFeedbackEmail({ fromDisplayName: displayName, fromEmail: user.email, ...parsed });

    res.json({ ok: true });
  });


  // Auth: Me
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    res.json({ user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, firstName: user.firstName, lastName: user.lastName, city: user.city, region: user.region, country: user.country, category: user.category ?? null, phone: user.phone ?? null, smsOptIn: (user as any).smsOptIn ?? false } });
  });

  // Profile update — first name / last name
  app.patch("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const { firstName, lastName, city, region, country, category, phone, smsOptIn } = z.object({
        firstName: z.string().max(100).optional().nullable(),
        lastName: z.string().max(100).optional().nullable(),
        city: z.string().max(100).optional().nullable(),
        region: z.string().max(100).optional().nullable(),
        country: z.string().max(100).optional().nullable(),
        category: z.string().max(50).optional().nullable(),
        phone: z.string().max(30).optional().nullable(),
        smsOptIn: z.boolean().optional(),
      }).parse(req.body);
      const prevProfile = await storage.getUserById(userId);
      const user = await storage.updateUserProfile(userId, {
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        city: city ?? null,
        region: region ?? null,
        country: country ?? null,
        category: category !== undefined ? (category ?? null) : undefined,
        phone: phone !== undefined ? (phone ?? null) : undefined,
        smsOptIn: smsOptIn !== undefined ? smsOptIn : undefined,
      });
      if (!user) return res.status(404).json({ error: "User not found" });
      // If user just opted in to SMS for the first time, send welcome SMS
      if (smsOptIn === true && !(prevProfile as any)?.smsOptIn && (user as any).phone) {
        sendWelcomeSms({ to: (user as any).phone, displayName: user.displayName }).catch(() => {});
      }
      res.json({ user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, firstName: user.firstName, lastName: user.lastName, city: user.city, region: user.region, country: user.country, category: user.category ?? null, phone: user.phone ?? null, smsOptIn: (user as any).smsOptIn ?? false } });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Custom Metrics
  app.get("/api/metrics/custom", requireAuth, async (req, res) => {
    const metrics = await storage.getCustomMetricsByUser(req.session!.userId!);
    res.json(metrics);
  });

  app.post("/api/metrics/custom", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const isPro = await storage.isPro(userId);
      if (!isPro) return res.status(403).json({ error: "Custom metrics require a Pro subscription" });
      const existing = await storage.getCustomMetricsByUser(userId);
      if (existing.length >= 4) return res.status(400).json({ error: "Maximum 4 custom metrics allowed" });
      const data = insertCustomMetricSchema.parse({ ...req.body, userId });
      const metric = await storage.createCustomMetric(data);
      res.json(metric);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.patch("/api/metrics/custom/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const updated = await storage.updateCustomMetric(id, req.session!.userId!, req.body);
    if (!updated) return res.status(404).json({ error: "Metric not found" });
    res.json(updated);
  });

  // Reorder custom metrics — accepts ordered array of IDs
  app.put("/api/metrics/custom/reorder", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const { order } = z.object({ order: z.array(z.number()) }).parse(req.body);
      // Update sortOrder for each metric in the provided order
      await Promise.all(
        order.map((id, idx) => storage.updateCustomMetric(id, userId, { sortOrder: idx }))
      );
      const updated = await storage.getCustomMetricsByUser(userId);
      res.json(updated);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  app.delete("/api/metrics/custom/:id", requireAuth, async (req, res) => {
    const id = parseInt(req.params.id);
    const ok = await storage.deleteCustomMetric(id, req.session!.userId!);
    if (!ok) return res.status(404).json({ error: "Metric not found" });
    res.json({ ok: true });
  });

  // Daily Entry — get or create for a date
  app.get("/api/entries/:date", requireAuth, async (req, res) => {
    const userId = req.session!.userId!;
    const dateStr = req.params.date; // YYYY-MM-DD
    const entry = await storage.getDailyEntry(userId, dateStr);
    if (!entry) return res.json(null);
    const scores = await storage.getMetricScoresByEntry(entry.id);
    res.json({ entry, scores });
  });

  // Save scores for a day
  app.post("/api/entries/:date/scores", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const dateStr = req.params.date;
      const { scores, notes, goalText } = z.object({
        scores: z.array(z.object({
          metricKey: z.string(),
          metricLabel: z.string(),
          rating: z.enum(["success", "setback", "skip"]),
        })),
        notes: z.string().optional(),
        goalText: z.string().optional(),
      }).parse(req.body);

      let entry = await storage.getDailyEntry(userId, dateStr);
      if (!entry) {
        entry = await storage.createDailyEntry({
          userId, entryDate: dateStr,
          notes: notes?.trim() || null,
          goalText: goalText?.trim() || null,
        });
      } else {
        const updates: Record<string, any> = {};
        if (notes !== undefined && (notes.trim() !== "" || notes === null)) {
          updates.notes = notes.trim() || null;
        }
        if (goalText !== undefined) {
          updates.goalText = goalText.trim() || null;
        }
        if (Object.keys(updates).length > 0) {
          await storage.updateDailyEntry(entry.id, updates);
        }
      }

      const saved = await storage.upsertMetricScores(entry.id, userId, scores);
      res.json({ entry, scores: saved });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Goal history — all daily entries with a goalText, newest first
  app.get("/api/goal-history", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const sched = await storage.getUserSchedule(userId);
      const tz = sched?.timezone || "UTC";
      // Fetch a broad range — last 2 years
      const end = new Date().toLocaleDateString("en-CA", { timeZone: tz });
      const startDate = new Date();
      startDate.setFullYear(startDate.getFullYear() - 2);
      const start = startDate.toLocaleDateString("en-CA", { timeZone: tz });
      const entries = await storage.getDailyEntriesByRange(userId, start, end);
      const goals = entries
        .filter(e => (e as any).goalText)
        .map(e => ({
          entryDate: e.entryDate,
          goalText: (e as any).goalText as string,
        }))
        .sort((a, b) => b.entryDate.localeCompare(a.entryDate));
      res.json(goals);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Rate a single metric immediately (captures exact timestamp for sparkline)
  app.post("/api/entries/:date/scores/one", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const dateStr = req.params.date;
      const { metricKey, metricLabel, rating } = z.object({
        metricKey: z.string(),
        metricLabel: z.string(),
        rating: z.enum(["success", "setback", "skip"]),
      }).parse(req.body);

      // Get or create today's entry
      let entry = await storage.getDailyEntry(userId, dateStr);
      if (!entry) {
        entry = await storage.createDailyEntry({ userId, entryDate: dateStr, notes: null });
      }

      // Upsert just this one metric with a fresh ratedAt
      await storage.upsertSingleMetricScore(entry.id, userId, { metricKey, metricLabel, rating });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Per-date metric timeline (used by history day drawer)
  app.get("/api/entries/:date/timeline", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const { date } = req.params; // YYYY-MM-DD
      const entry = await storage.getDailyEntry(userId, date);
      if (!entry) return res.json([]);
      const scores = await storage.getMetricScoresByEntry(entry.id);
      const timeline = scores
        .filter(s => s.rating !== "skip")
        .map(s => ({
          metricKey: s.metricKey,
          metricLabel: s.metricLabel,
          rating: s.rating,
          ratedAt: (s as any).ratedAt ?? null,
        }))
        .filter(s => s.ratedAt !== null)
        .sort((a, b) => new Date(a.ratedAt!).getTime() - new Date(b.ratedAt!).getTime());
      res.json(timeline);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Today's metric timeline — all scored metrics with their ratedAt timestamps
  app.get("/api/today/timeline", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const sched = await storage.getUserSchedule(userId);
      const tz = sched?.timezone || "UTC";
      const today = new Date().toLocaleDateString("en-CA", { timeZone: tz });
      const entry = await storage.getDailyEntry(userId, today);
      if (!entry) return res.json([]);
      const scores = await storage.getMetricScoresByEntry(entry.id);
      // Return all rated (non-skip) metrics with a ratedAt — core + custom
      const timeline = scores
        .filter(s => s.rating !== "skip")
        .map(s => ({
          metricKey: s.metricKey,
          metricLabel: s.metricLabel,
          rating: s.rating,
          ratedAt: (s as any).ratedAt ?? null,
        }))
        .filter(s => s.ratedAt !== null)
        .sort((a, b) => new Date(a.ratedAt!).getTime() - new Date(b.ratedAt!).getTime());
      res.json(timeline);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Dashboard: date range summary
  app.get("/api/dashboard", requireAuth, async (req, res) => {
    const userId = req.session!.userId!;
    const { startDate, endDate } = z.object({
      startDate: z.string(),
      endDate: z.string(),
    }).parse(req.query);

    const entries = await storage.getDailyEntriesByRange(userId, startDate, endDate);
    const result = [];
    for (const entry of entries) {
      const scores = await storage.getMetricScoresByEntry(entry.id);
      const successCount = scores.filter(s => s.rating === "success").length;
      const setbackCount = scores.filter(s => s.rating === "setback").length;
      const total = successCount - setbackCount;
      result.push({ entry, scores, successCount, setbackCount, total });
    }
    res.json(result);
  });

  // Billing — Subscription status
  app.get("/api/billing/status", requireAuth, async (req, res) => {
    const sub = await storage.getSubscription(req.session!.userId!);
    const user = await storage.getUserById(req.session!.userId!);
    const isAdminUser = user?.email === ADMIN_EMAIL;
    const isPro = isAdminUser || await storage.isPro(req.session!.userId!);
    res.json({
      isPro,
      plan: isAdminUser && !sub?.plan ? "pro_annual" : (sub?.plan || "free"),
      status: isAdminUser ? "active" : (sub?.status || "inactive"),
      currentPeriodEnd: sub?.currentPeriodEnd || null,
      prices: {
        monthly: PRICE_MONTHLY,
        annual: PRICE_ANNUAL,
        monthlyAmount: 999,
        annualAmount: 9900,
        groupMonthly: PRICE_GROUP_MONTHLY,
        groupAnnual: PRICE_GROUP_ANNUAL,
        groupMonthlyAmount: 9500,
        groupAnnualAmount: 89900,
      },
    });
  });

  // Billing — Create Checkout Session
  app.post("/api/billing/checkout", requireAuth, async (req, res) => {
    try {
      const { priceId } = z.object({ priceId: z.string().min(1, "Price ID is required") }).parse(req.body);
      const user = await storage.getUserById(req.session!.userId!);
      if (!user) return res.status(404).json({ error: "User not found" });
      if (!stripe) return res.status(503).json({ error: "Stripe is not configured on the server. Check STRIPE_SECRET_KEY." });
      if (!priceId.startsWith("price_")) return res.status(400).json({ error: "Invalid price ID. Check STRIPE_PRICE_MONTHLY / STRIPE_PRICE_ANNUAL env vars." });
      const url = await createCheckoutSession(req.session!.userId!, priceId, user.email);
      res.json({ url });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Billing — Customer Portal
  app.post("/api/billing/portal", requireAuth, async (req, res) => {
    try {
      if (!stripe) return res.status(503).json({ error: "Billing not configured" });
      const url = await createBillingPortalSession(req.session!.userId!);
      res.json({ url });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Billing — Stripe Webhook (raw body needed)
  app.post("/api/billing/webhook",
    express.raw({ type: "application/json" }),
    async (req, res) => {
      const sig = req.headers["stripe-signature"] as string;
      try {
        await handleWebhook(req.body as Buffer, sig);
        res.json({ received: true });
      } catch (e: any) {
        console.error("Webhook error:", e.message);
        res.status(400).send(`Webhook Error: ${e.message}`);
      }
    }
  );

  // Metric Content — public GET (anyone logged in can read)
  app.get("/api/metric-content", requireAuth, async (_req, res) => {
    const content = await storage.getAllMetricContent();
    res.json(content);
  });

  // Metric Content — admin upsert (session-based admin check)
  app.post("/api/admin/metric-content", requireAdmin, async (req, res) => {
    try {
      const schema = z.object({
        metricKey: z.enum(["TIME", "GOAL", "TEAM", "TASK", "VIEW", "PACE"]),
        subtext: z.string().max(200).optional().nullable(),
        prompt: z.string().max(300).optional().nullable(),
        story: z.string().max(2000).optional().nullable(),
        imageUrl: z.string().url().optional().nullable().or(z.literal("")),
        quote: z.string().max(500).optional().nullable(),
        quoteAuthor: z.string().max(100).optional().nullable(),
      });
      const data = schema.parse(req.body);
      const result = await storage.upsertMetricContent({
        metricKey: data.metricKey,
        subtext: data.subtext || null,
        prompt: data.prompt || null,
        story: data.story || null,
        imageUrl: data.imageUrl || null,
        quote: data.quote || null,
        quoteAuthor: data.quoteAuthor || null,
      });
      res.json(result);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Admin: List all members with stats
  app.get("/api/admin/members", requireAdmin, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const members = await Promise.all(
        allUsers.map(async (u) => {
          const [sub, sched, latestEntry] = await Promise.all([
            storage.getSubscription(u.id),
            storage.getUserSchedule(u.id),
            storage.getLatestDailyEntry(u.id),
          ]);
          const isPro = sub?.status === "active" && !!sub.currentPeriodEnd && sub.currentPeriodEnd > new Date();

          // Compute score for the most recent day
          let latestScore: { date: string; score: number; wins: number; losses: number } | null = null;
          if (latestEntry) {
            const scores = await storage.getMetricScoresByEntry(latestEntry.id);
            const wins = scores.filter(s => s.rating === "success").length;
            const losses = scores.filter(s => s.rating === "setback").length;
            latestScore = {
              date: latestEntry.entryDate,
              score: wins - losses,
              wins,
              losses,
            };
          }

          return {
            id: u.id,
            username: u.username,
            email: u.email,
            displayName: u.displayName,
            firstName: u.firstName || null,
            lastName: u.lastName || null,
            createdAt: u.createdAt,
            plan: sub?.plan || "free",
            planStatus: sub?.status || "inactive",
            isPro,
            timezone: sched?.timezone || null,
            latestScore,
          };
        })
      );
      res.json(members);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: Upgrade user to Pro
  app.post("/api/admin/users/:id/upgrade", requireAdmin, async (req, res) => {
    try {
      const targetId = parseInt(req.params.id);
      const target = await storage.getUserById(targetId);
      if (!target) return res.status(404).json({ error: "User not found" });
      if (target.email === ADMIN_EMAIL) return res.status(400).json({ error: "Cannot modify admin account" });
      await storage.upsertSubscription({
        userId: targetId,
        plan: "monthly",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000),
      });
      // Fire-and-forget upgrade notification email + HubSpot sync
      sendUpgradeEmail({
        toEmail: target.email,
        displayName: target.displayName || target.username,
      }).catch(err => console.error("[email] upgrade email error:", err));
      hubspotSyncPlanChange(target, "pro").catch(() => {});
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: Downgrade user to Free
  app.post("/api/admin/users/:id/downgrade", requireAdmin, async (req, res) => {
    try {
      const targetId = parseInt(req.params.id);
      const target = await storage.getUserById(targetId);
      if (!target) return res.status(404).json({ error: "User not found" });
      if (target.email === ADMIN_EMAIL) return res.status(400).json({ error: "Cannot modify admin account" });
      await storage.upsertSubscription({
        userId: targetId,
        plan: "free",
        status: "inactive",
        currentPeriodEnd: new Date(Date.now() - 1000),
      });
      hubspotSyncPlanChange(target, "free").catch(() => {});
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: Delete user account and all data
  app.delete("/api/admin/users/:id", requireAdmin, async (req, res) => {
    try {
      const targetId = parseInt(req.params.id);
      const target = await storage.getUserById(targetId);
      if (!target) return res.status(404).json({ error: "User not found" });
      if (target.email === ADMIN_EMAIL) return res.status(400).json({ error: "Cannot delete admin account" });
      hubspotSyncDeleteUser(target.email).catch(() => {});
      await storage.deleteUser(targetId);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: Promote user to Pro (protected by ADMIN_SECRET env var)
  app.post("/api/admin/promote", async (req, res) => {
    try {
      const adminSecret = process.env.ADMIN_SECRET;
      if (!adminSecret) return res.status(503).json({ error: "ADMIN_SECRET not configured" });
      const authHeader = req.headers["x-admin-secret"];
      if (authHeader !== adminSecret) return res.status(403).json({ error: "Forbidden" });

      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user) return res.status(404).json({ error: "User not found" });

      const sub = await storage.upsertSubscription({
        userId: user.id,
        plan: "monthly",
        status: "active",
        currentPeriodEnd: new Date(Date.now() + 10 * 365 * 24 * 60 * 60 * 1000), // 10 years
      });

      res.json({ ok: true, user: { id: user.id, email: user.email, username: user.username }, subscription: sub });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // User Schedule
  app.get("/api/schedule", requireAuth, async (req, res) => {
    const schedule = await storage.getUserSchedule(req.session!.userId!);
    res.json(schedule || null);
  });

  app.post("/api/schedule", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const data = insertUserScheduleSchema.parse({ ...req.body, userId });
      const schedule = await storage.upsertUserSchedule({ ...data, userId });
      res.json(schedule);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Site Pages — public read (authenticated users)
  // Public legal pages — no auth required
  app.get("/api/public/legal/:key", async (req, res) => {
    try {
      const { key } = req.params;
      if (!["terms", "privacy", "eula"].includes(key)) {
        return res.status(400).json({ error: "Invalid legal page key" });
      }
      const page = await storage.getSitePage(key);
      res.json(page || null);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Public start page config — no auth required (used by the marketing landing page)
  app.get("/api/public/start", async (req, res) => {
    try {
      const page = await storage.getSitePage("start");
      res.json(page || null);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Public SEO config — no auth required (injected into <head> on every page)
  app.get("/api/public/seo", async (req, res) => {
    try {
      const page = await storage.getSitePage("seo");
      res.json(page || null);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Public login page config — no auth required (used before user is logged in)
  app.get("/api/public/login-page", async (req, res) => {
    try {
      const page = await storage.getSitePage("login");
      res.json(page || null);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/public/register-page", async (req, res) => {
    try {
      const page = await storage.getSitePage("register");
      res.json(page || null);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/public/reasons", async (req, res) => {
    try {
      const page = await storage.getSitePage("reasons");
      res.json(page || null);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/pages/:pageKey", requireAuth, async (req, res) => {
    try {
      const page = await storage.getSitePage(req.params.pageKey);
      if (!page) return res.status(404).json({ error: "Page not found" });
      res.json(page);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.get("/api/pages", requireAuth, async (req, res) => {
    try {
      const pages = await storage.getAllSitePages();
      res.json(pages);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Site Pages — admin write
  app.put("/api/admin/pages/:pageKey", requireAdmin, async (req, res) => {
    try {
      const pageKey = req.params.pageKey;
      const CATEGORY_KEYS = ["cat_athlete","cat_graduate","cat_recovery","cat_veteran","cat_caregiver","cat_entrepreneur","cat_writer","cat_musician"];
      if (!["story", "tracking", "connect", "login", "register", "terms", "privacy", "eula", "timeline", "seo", "start", "reasons", ...CATEGORY_KEYS].includes(pageKey)) {
        return res.status(400).json({ error: "Invalid page key" });
      }
      const data = insertSitePageSchema.parse({ ...req.body, pageKey });
      const page = await storage.upsertSitePage(data);
      res.json(page);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Invite & Connections ────────────────────────────────────────────────────

  // Send an invite via email
  app.post("/api/invites", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const sender = await storage.getUserById(userId);
      if (!sender) return res.status(401).json({ error: "Unauthorized" });

      const schema = z.object({
        inviteeEmail: z.string().email("Please enter a valid email address"),
        message: z.string().max(300).optional(),
      });
      const { inviteeEmail, message } = schema.parse(req.body);

      // Don't allow inviting yourself
      if (inviteeEmail.toLowerCase() === sender.email.toLowerCase()) {
        return res.status(400).json({ error: "You can't invite yourself" });
      }

      // Check if already connected
      const existingUser = await storage.getUserByEmail(inviteeEmail);
      if (existingUser) {
        const conns = await storage.getConnectionsByUser(userId);
        const alreadyConnected = conns.some(c =>
          (c.userId === userId && c.partnerId === existingUser.id) ||
          (c.userId === existingUser.id && c.partnerId === userId)
        );
        if (alreadyConnected) return res.status(400).json({ error: "You're already connected with this person" });
      }

      const token = randomBytes(32).toString("hex");
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

      const invite = await storage.createInvite({
        senderId: userId,
        inviteeEmail,
        inviteePhone: null,
        token,
        message: message || null,
        status: "pending",
        acceptedByUserId: null,
        expiresAt,
      });

      const appUrl = process.env.APP_URL || "https://sweet-momentum.onrender.com";
      const inviteUrl = `${appUrl}/#/invite/${token}`;

      const senderName = sender.firstName && sender.lastName
        ? `${sender.firstName} ${sender.lastName}`
        : sender.displayName || sender.username;

      // Send email (non-blocking — SMTP errors are logged, not thrown)
      sendInviteEmail({ senderName, senderEmail: sender.email, inviteeEmail, message: message || undefined, inviteUrl }).catch(() => {});

      res.json({ ok: true, inviteId: invite.id });
    } catch (e: any) {
      const msg = e?.errors?.[0]?.message || e.message || "Failed to send invite";
      res.status(400).json({ error: msg });
    }
  });

  // Get my sent invites
  app.get("/api/invites", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const sentInvites = await storage.getInvitesBySender(userId);
      res.json(sentInvites);
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Preview invite (public — no auth needed, used on the accept page before signup)
  app.get("/api/invites/:token", async (req, res) => {
    try {
      const invite = await storage.getInviteByToken(req.params.token);
      if (!invite) return res.status(404).json({ error: "Invite not found" });
      if (invite.status !== "pending") return res.status(410).json({ error: "This invite has already been used or expired" });
      if (new Date() > invite.expiresAt) {
        await storage.updateInviteStatus(invite.id, "expired");
        return res.status(410).json({ error: "This invite has expired" });
      }
      const sender = await storage.getUserById(invite.senderId);
      const senderName = sender
        ? (sender.firstName && sender.lastName ? `${sender.firstName} ${sender.lastName}` : sender.displayName || sender.username)
        : "A Sweet Momentum member";
      res.json({
        senderName,
        message: invite.message,
        inviteeEmail: invite.inviteeEmail,
        status: invite.status,
      });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Helper: accept an invite for a known userId within an already-saved session
  async function acceptInviteForUser(token: string, userId: number): Promise<{ error?: string }> {
    const invite = await storage.getInviteByToken(token);
    if (!invite) return { error: "Invite not found" };
    if (invite.status !== "pending") return { error: "This invite has already been used" };
    if (new Date() > invite.expiresAt) {
      await storage.updateInviteStatus(invite.id, "expired");
      return { error: "This invite link has expired" };
    }
    if (invite.senderId === userId) return { error: "You can\'t accept your own invite" };
    await storage.createConnection(invite.senderId, userId, invite.id);
    await storage.updateInviteStatus(invite.id, "accepted", userId);
    return {};
  }

  // Accept invite (existing logged-in user)
  app.post("/api/invites/:token/accept", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const result = await acceptInviteForUser(req.params.token, userId);
      if (result.error) return res.status(410).json({ error: result.error });
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Register + accept invite in one atomic request (no session race condition)
  app.post("/api/invites/:token/register", async (req, res) => {
    try {
      const raw = z.object({
        email: z.string().email(),
        password: z.string().min(8),
        displayName: z.string().min(1),
      }).parse(req.body);
      const existingEmail = await storage.getUserByEmail(raw.email);
      // Return a specific code so the client can switch to login mode
      if (existingEmail) return res.status(409).json({ error: "Email already registered", existingAccount: true });
      const username = await deriveUsername(raw.email);
      const data = { ...raw, username };

      const user = await storage.createUser({ ...data, password: hashPassword(data.password) });
      req.session!.userId = user.id;
      await storage.upsertUserSchedule({
        userId: user.id, wakeTime: "06:00", sleepTime: "22:00",
        workStartTime: "09:00", workEndTime: "17:00",
        timezone: "America/New_York", dailyGoal: "",
      });
      await new Promise<void>((resolve, reject) => req.session!.save(err => err ? reject(err) : resolve()));

      // Sync to HubSpot (fire-and-forget)
      hubspotSyncNewUser(user, "America/New_York").catch(() => {});

      // Accept the invite now that session is saved
      const result = await acceptInviteForUser(req.params.token, user.id);
      if (result.error) {
        // Still return success for registration — just note invite failed
        return res.json({ user: { id: user.id, email: user.email, username: user.username }, inviteError: result.error });
      }
      res.json({ user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName } });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Registration failed" });
    }
  });

  // Login + accept invite in one atomic request
  app.post("/api/invites/:token/login", async (req, res) => {
    try {
      const { email, password } = z.object({ email: z.string(), password: z.string() }).parse(req.body);
      const user = await storage.getUserByEmail(email);
      if (!user || !verifyPassword(password, user.password)) {
        return res.status(401).json({ error: "Invalid email or password" });
      }
      req.session!.userId = user.id;
      await new Promise<void>((resolve, reject) => req.session!.save(err => err ? reject(err) : resolve()));

      const result = await acceptInviteForUser(req.params.token, user.id);
      if (result.error) {
        return res.json({ user: { id: user.id, email: user.email, username: user.username }, inviteError: result.error });
      }
      res.json({ user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName } });
    } catch (e: any) {
      res.status(400).json({ error: e.message || "Login failed" });
    }
  });

  // Get my connections (with partner info)
  app.get("/api/connections", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const conns = await storage.getConnectionsByUser(userId);
      // Use the viewing user's timezone to compute "today" correctly
      const viewerSchedule = await storage.getUserSchedule(userId);
      const viewerTz = viewerSchedule?.timezone || "UTC";
      const today = new Date().toLocaleDateString("en-CA", { timeZone: viewerTz }); // YYYY-MM-DD in user's tz

      const enriched = await Promise.all(conns.map(async (c) => {
        const partnerId = c.userId === userId ? c.partnerId : c.userId;
        const partner = await storage.getUserById(partnerId);
        if (!partner) return null;
        const partnerName = partner.firstName && partner.lastName
          ? `${partner.firstName} ${partner.lastName}`
          : partner.displayName || partner.username;
        // Also try partner's own "today" in case their timezone differs
        const partnerSchedule = await storage.getUserSchedule(partnerId);
        const partnerTz = partnerSchedule?.timezone || viewerTz;
        const partnerToday = new Date().toLocaleDateString("en-CA", { timeZone: partnerTz });
        // Prefer partner's own today; fall back to viewer's today
        let todayScore = await storage.getPartnerDailyScore(partnerId, partnerToday);
        if (!todayScore && partnerToday !== today) {
          todayScore = await storage.getPartnerDailyScore(partnerId, today);
        }
        return {
          connectionId: c.id,
          partnerId,
          partnerName,
          partnerUsername: partner.username,
          todayScore: todayScore?.score ?? null,
          connectedSince: c.createdAt,
        };
      }));

      res.json(enriched.filter(Boolean));
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Remove a connection
  app.delete("/api/connections/:partnerId", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const partnerId = parseInt(req.params.partnerId);
      await storage.removeConnection(userId, partnerId);
      res.json({ ok: true });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // ── Email Templates (admin only) ──────────────────────────────────────────
  // Metric streaks — consecutive days a metric has been "success"
  app.get("/api/metrics/streaks", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;

      // Pull last 90 days of entries + their scores
      const today = new Date();
      const toISO = (d: Date) => d.toISOString().slice(0, 10);
      const ninetyDaysAgo = new Date(today);
      ninetyDaysAgo.setDate(today.getDate() - 90);
      const startDate = toISO(ninetyDaysAgo);
      const endDate   = toISO(today);

      const entries = await storage.getDailyEntriesByRange(userId, startDate, endDate);

      // Build a map: entryDate -> { metricKey -> rating }
      const dateRatingMap: Record<string, Record<string, string>> = {};
      for (const entry of entries) {
        const scores = await storage.getMetricScoresByEntry(entry.id);
        const map: Record<string, string> = {};
        for (const s of scores) map[s.metricKey] = s.rating;
        dateRatingMap[entry.entryDate] = map;
      }

      // Build list of all metric keys present across all entries
      const allKeys = new Set<string>();
      for (const map of Object.values(dateRatingMap)) {
        for (const k of Object.keys(map)) allKeys.add(k);
      }

      // For each metric key, walk backwards from today counting consecutive successes
      const streaks: Record<string, number> = {};
      for (const key of Array.from(allKeys)) {
        let streak = 0;
        let day = new Date(today);
        day.setHours(12, 0, 0, 0);
        // Walk back up to 90 days
        for (let i = 0; i < 90; i++) {
          const dateStr = toISO(day);
          const dayRatings = dateRatingMap[dateStr];
          if (!dayRatings || dayRatings[key] !== "success") break;
          streak++;
          day.setDate(day.getDate() - 1);
        }
        if (streak > 0) streaks[key] = streak;
      }

      res.json(streaks);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // ── Momentum Groups ───────────────────────────────────────────────────────────

  // Get all groups the user is part of (moderator or active member)
  app.get("/api/groups", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const [moderated, member] = await Promise.all([
        storage.getGroupsByModerator(userId),
        storage.getGroupsByMember(userId),
      ]);
      // Deduplicate
      const seen = new Set<number>();
      const all = [...moderated, ...member].filter(g => { if (seen.has(g.id)) return false; seen.add(g.id); return true; });
      res.json(all);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Create a group (Pro only)
  app.post("/api/groups", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const sub = await storage.getSubscription(userId);
      const isPro = sub?.status === 'active';
      if (!isPro) return res.status(403).json({ error: 'Pro subscription required to create a Momentum Group' });
      const { name, description, discountCode } = z.object({
        name: z.string().min(1).max(100),
        description: z.string().max(500).optional(),
        discountCode: z.string().max(50).optional(),
      }).parse(req.body);
      const group = await storage.createGroup({ name, description: description ?? null, moderatorId: userId, maxSeats: 10, discountCode: discountCode ?? null });
      // Auto-add moderator as active member
      const user = await storage.getUserById(userId);
      await storage.addGroupMember({ groupId: group.id, userId, inviteEmail: user?.email ?? null, status: 'active', joinedAt: new Date() });
      res.json(group);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Get single group (must be member or moderator)
  app.get("/api/groups/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const group = await storage.getGroupById(parseInt(req.params.id));
      if (!group) return res.status(404).json({ error: 'Group not found' });
      const isMod = group.moderatorId === userId;
      const membership = await storage.getGroupMemberByUserId(group.id, userId);
      if (!isMod && (!membership || membership.status !== 'active')) return res.status(403).json({ error: 'Not a member of this group' });
      const members = await storage.getGroupMembers(group.id);
      // Enrich with user display info + today score
      const today = new Date().toISOString().slice(0, 10);
      const enriched = await Promise.all(members.filter(m => m.status !== 'removed').map(async m => {
        if (!m.userId) return { ...m, displayName: null, todayScore: null };
        const u = await storage.getUserById(m.userId);
        const displayName = u ? (u.firstName && u.lastName ? `${u.firstName} ${u.lastName}` : u.displayName || u.email) : null;
        const todayScore = await storage.getPartnerDailyScore(m.userId, today);
        return { ...m, displayName, todayScore: todayScore ?? null };
      }));
      res.json({ group, members: enriched, isModerator: isMod });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Update group (moderator only)
  app.patch("/api/groups/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const updates = z.object({
        name: z.string().min(1).max(100).optional(),
        description: z.string().max(500).optional(),
        discountCode: z.string().max(50).nullable().optional(),
      }).parse(req.body);
      const group = await storage.updateGroup(parseInt(req.params.id), userId, updates);
      if (!group) return res.status(404).json({ error: 'Group not found or not authorized' });
      res.json(group);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Delete group (moderator only)
  app.delete("/api/groups/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      await storage.deleteGroup(parseInt(req.params.id), userId);
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Invite a member to a group (moderator only)
  app.post("/api/groups/:id/invite", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const groupId = parseInt(req.params.id);
      const group = await storage.getGroupById(groupId);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      if (group.moderatorId !== userId) return res.status(403).json({ error: 'Only the moderator can invite members' });
      // Check seat capacity
      const members = await storage.getGroupMembers(groupId);
      const activeCount = members.filter(m => m.status !== 'removed').length;
      if (activeCount >= group.maxSeats) return res.status(400).json({ error: `Group is at capacity (${group.maxSeats} seats). Request more seats to add members.` });
      const { email } = z.object({ email: z.string().email() }).parse(req.body);
      // Check not already member
      const existing = await storage.getGroupMemberByEmail(groupId, email);
      if (existing && existing.status !== 'removed') return res.status(400).json({ error: 'This person is already in the group or has a pending invite' });
      // Check if user already exists in the system
      const invitedUser = await storage.getUserByEmail(email);
      const member = await storage.addGroupMember({
        groupId, userId: invitedUser?.id ?? null, inviteEmail: email, status: invitedUser ? 'active' : 'invited', joinedAt: invitedUser ? new Date() : null,
      });
      // Send invite email
      const moderator = await storage.getUserById(userId);
      const modName = moderator?.displayName || moderator?.email || 'Someone';
      const APP_URL = process.env.APP_URL || 'https://sweetmo.io';
      const discountNote = group.discountCode ? `\n\nAs a new Sweet Momentum member joining through ${group.name}, you qualify for a discount. Use code <strong>${group.discountCode}</strong> at checkout.` : '';
      try {
        const transporter = createTransporter();
        if (transporter) {
          await transporter.sendMail({
            from: process.env.SMTP_FROM_EMAIL ? `"Sweet Momentum" <${process.env.SMTP_FROM_EMAIL}>` : `"Sweet Momentum" <${process.env.SMTP_USER}>`,
            to: email,
            subject: `${modName} invited you to join the ${group.name} Momentum Group`,
            html: `<body style="font-family:sans-serif;background:#0f0f0f;padding:40px;"><div style="max-width:540px;margin:0 auto;background:#1a1a1a;border-radius:12px;overflow:hidden;"><div style="background:#FF6E00;padding:28px;text-align:center;"><h1 style="color:#fff;margin:0;font-size:22px;">Sweet Momentum</h1></div><div style="padding:28px;"><p style="color:#e0e0e0;font-size:15px;">${modName} has invited you to join the <strong style="color:#FF6E00;">${group.name}</strong> Momentum Group on Sweet Momentum.</p>${discountNote ? `<p style="color:#e0e0e0;font-size:14px;margin-top:16px;">${discountNote}</p>` : ''}<div style="text-align:center;margin:28px 0;"><a href="${APP_URL}/#/register" style="background:#FF6E00;color:#fff;text-decoration:none;font-size:15px;font-weight:700;padding:14px 36px;border-radius:8px;display:inline-block;">Join Sweet Momentum</a></div><p style="color:#666;font-size:12px;text-align:center;">Already have an account? Sign in and your group membership will activate automatically.</p></div></div></body>`,
            text: `${modName} invited you to join the ${group.name} Momentum Group on Sweet Momentum.${group.discountCode ? ` Use code ${group.discountCode} for a discount.` : ''} Sign up at ${APP_URL}`,
          });
        }
      } catch (emailErr) { console.warn('[groups] Invite email error:', emailErr); }
      res.json(member);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Remove a member (moderator only)
  app.delete("/api/groups/:id/members/:memberId", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const groupId = parseInt(req.params.id);
      const group = await storage.getGroupById(groupId);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      if (group.moderatorId !== userId) return res.status(403).json({ error: 'Only the moderator can remove members' });
      await storage.removeGroupMember(parseInt(req.params.memberId), groupId);
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Request more seats — sends email to admin
  app.post("/api/groups/:id/request-seats", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const groupId = parseInt(req.params.id);
      const group = await storage.getGroupById(groupId);
      if (!group) return res.status(404).json({ error: 'Group not found' });
      if (group.moderatorId !== userId) return res.status(403).json({ error: 'Only the moderator can request more seats' });
      const { seatsRequested, reason } = z.object({
        seatsRequested: z.number().int().min(1).max(50),
        reason: z.string().max(500).optional(),
      }).parse(req.body);
      const user = await storage.getUserById(userId);
      const APP_URL = process.env.APP_URL || 'https://sweetmo.io';
      try {
        const transporter = createTransporter();
        if (transporter) {
          await transporter.sendMail({
            from: process.env.SMTP_FROM_EMAIL ? `"Sweet Momentum" <${process.env.SMTP_FROM_EMAIL}>` : `"Sweet Momentum" <${process.env.SMTP_USER}>`,
            to: 'track@sweetmo.io',
            subject: `Seat Request: ${group.name} (Group #${groupId})`,
            html: `<p><strong>Group:</strong> ${group.name} (ID: ${groupId})</p><p><strong>Moderator:</strong> ${user?.email}</p><p><strong>Current seats:</strong> ${group.maxSeats}</p><p><strong>Seats requested:</strong> ${seatsRequested}</p><p><strong>Reason:</strong> ${reason || 'None provided'}</p>`,
            text: `Seat request for group "${group.name}" (ID: ${groupId})\nModerator: ${user?.email}\nCurrent seats: ${group.maxSeats}\nRequested: ${seatsRequested}\nReason: ${reason || 'None'}`,
          });
        }
      } catch (emailErr) { console.warn('[groups] Seat request email error:', emailErr); }
      res.json({ ok: true, message: 'Seat request sent to the Sweet Momentum team. We\'ll be in touch within 1-2 business days.' });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Day Counters
  app.get("/api/day-counters", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      res.json(await storage.getDayCounters(userId));
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/day-counters", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const existing = await storage.getDayCounters(userId);
      if (existing.length >= 4) return res.status(400).json({ error: "Maximum of 4 counters allowed" });
      const { type, label, counterDate } = z.object({
        type: z.enum(["since", "until"]),
        label: z.string().min(1).max(100),
        counterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
      }).parse(req.body);
      const counter = await storage.createDayCounter({ userId, type, label, counterDate });
      res.json(counter);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.patch("/api/day-counters/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const id = parseInt(req.params.id);
      const updates = z.object({
        type: z.enum(["since", "until"]).optional(),
        label: z.string().min(1).max(100).optional(),
        counterDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
      }).parse(req.body);
      const counter = await storage.updateDayCounter(id, userId, updates);
      if (!counter) return res.status(404).json({ error: "Counter not found" });
      res.json(counter);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/day-counters/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      await storage.deleteDayCounter(parseInt(req.params.id), userId);
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Goal List
  app.get("/api/goals", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const goals = await storage.getGoalItems(userId);
      res.json(goals);
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  app.post("/api/goals", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const { text, timeframe, targetDate } = z.object({
        text: z.string().min(1).max(500),
        timeframe: z.enum(["this_week", "this_month", "this_year"]).default("this_month"),
        targetDate: z.string().nullable().optional(),
      }).parse(req.body);
      const existing = await storage.getGoalItems(userId);
      const sortOrder = existing.length;
      const goal = await storage.createGoalItem({ userId, text, timeframe, targetDate: targetDate || null, sortOrder, completed: false });
      res.json(goal);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.patch("/api/goals/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const id = parseInt(req.params.id);
      const updates = z.object({
        text: z.string().min(1).max(500).optional(),
        timeframe: z.enum(["this_week", "this_month", "this_year"]).optional(),
        targetDate: z.string().nullable().optional(),
        sortOrder: z.number().int().optional(),
        completed: z.boolean().optional(),
      }).parse(req.body);
      const goal = await storage.updateGoalItem(id, userId, updates);
      if (!goal) return res.status(404).json({ error: "Goal not found" });
      res.json(goal);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.delete("/api/goals/:id", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const id = parseInt(req.params.id);
      await storage.deleteGoalItem(id, userId);
      res.json({ ok: true });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  app.put("/api/goals/reorder", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const { order } = z.object({ order: z.array(z.number()) }).parse(req.body);
      await Promise.all(order.map((id, idx) => storage.updateGoalItem(id, userId, { sortOrder: idx })));
      const goals = await storage.getGoalItems(userId);
      res.json(goals);
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

    app.get("/api/admin/email-templates/:key", requireAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      const template = await storage.getEmailTemplate(key);
      if (!template) return res.status(404).json({ error: "Template not found" });
      res.json(template);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  app.put("/api/admin/email-templates/:key", requireAdmin, async (req, res) => {
    try {
      const { key } = req.params;
      const { subject, bodyHtml, bodyText } = req.body;
      if (!subject || !bodyHtml || !bodyText) {
        return res.status(400).json({ error: "subject, bodyHtml, and bodyText are required" });
      }
      const template = await storage.upsertEmailTemplate(key, subject, bodyHtml, bodyText);
      res.json(template);
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: send weekly digest to all users (or a single user for testing)
  app.post("/api/admin/send-weekly-digest", requireAdmin, async (req, res) => {
    try {
      const { userId: targetUserId } = req.body; // optional — omit to send to all

      // Compute last Monday → Sunday in UTC
      const now = new Date();
      const dayOfWeek = now.getUTCDay(); // 0=Sun, 1=Mon … 6=Sat
      const daysToLastMonday = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
      const lastMonday = new Date(now);
      lastMonday.setUTCDate(now.getUTCDate() - daysToLastMonday - 7);
      const lastSunday = new Date(lastMonday);
      lastSunday.setUTCDate(lastMonday.getUTCDate() + 6);

      const toISO = (d: Date) => d.toISOString().slice(0, 10);
      const weekStart = toISO(lastMonday);
      const weekEnd   = toISO(lastSunday);

      // Build list of all 7 dates
      const allDates: string[] = [];
      for (let i = 0; i < 7; i++) {
        const d = new Date(lastMonday);
        d.setUTCDate(lastMonday.getUTCDate() + i);
        allDates.push(toISO(d));
      }

      const users = targetUserId
        ? [await storage.getUserById(Number(targetUserId))].filter(Boolean)
        : await storage.getAllUsers();

      let sent = 0;
      let errors = 0;

      for (const u of users as any[]) {
        try {
          // Fetch entries in range
          const dbEntries = await storage.getDailyEntriesByRange(u.id, weekStart, weekEnd);
          const entryMap = new Map(dbEntries.map(e => [e.entryDate, e]));

          // For each date, build summary
          const entrySummaries = await Promise.all(allDates.map(async date => {
            const entry = entryMap.get(date);
            if (!entry) return { entryDate: date, score: 0, scored: false, metrics: [] };
            const scores = await storage.getMetricScoresByEntry(entry.id);
            const successes = scores.filter(s => s.rating === "success").length;
            const setbacks  = scores.filter(s => s.rating === "setback").length;
            const score = successes - setbacks;
            return {
              entryDate: date,
              score,
              scored: scores.length > 0,
              metrics: scores.map(s => ({ label: s.metricLabel, rating: s.rating })),
            };
          }));

          await sendWeeklyDigestEmail({
            toEmail: u.email,
            displayName: u.displayName || u.email,
            weekStart,
            weekEnd,
            entries: entrySummaries,
          });
          sent++;
        } catch (userErr: any) {
          console.error(`[digest] Error for user ${u.email}:`, userErr?.message);
          errors++;
        }
      }

      res.json({ ok: true, sent, errors, weekStart, weekEnd });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: send inactivity reminder to users who haven't scored in 3+ days
  app.post("/api/admin/send-reminder-emails", requireAdmin, async (req, res) => {
    try {
      const { userId: targetUserId, thresholdDays: rawThreshold } = req.body;
      const thresholdDays = Number(rawThreshold) || 3;

      const now = new Date();
      const toISO = (d: Date) => d.toISOString().slice(0, 10);

      const allUsers = targetUserId
        ? [await storage.getUserById(Number(targetUserId))].filter(Boolean)
        : await storage.getAllUsers();

      let sent = 0, skipped = 0, errors = 0;

      for (const u of allUsers as any[]) {
        try {
          // Skip admin account
          if (u.email === "track@sweetmo.io") { skipped++; continue; }

          const latest = await storage.getLatestDailyEntry(u.id);

          let daysSince: number | null = null;
          if (!latest) {
            // Never scored — check if account is at least 3 days old
            const accountAge = Math.floor((now.getTime() - new Date(u.createdAt).getTime()) / 86400000);
            if (accountAge < thresholdDays) { skipped++; continue; }
            daysSince = null; // will show "never scored" copy
          } else {
            const lastDate = new Date(latest.entryDate + "T12:00:00Z");
            daysSince = Math.floor((now.getTime() - lastDate.getTime()) / 86400000);
            if (daysSince < thresholdDays) { skipped++; continue; }
          }

          await sendReminderEmail({
            toEmail: u.email,
            displayName: u.displayName || u.email,
            daysSinceLastScore: daysSince,
          });
          sent++;
        } catch (userErr: any) {
          console.error(`[reminder] Error for user ${u.email}:`, userErr?.message);
          errors++;
        }
      }

      res.json({ ok: true, sent, skipped, errors, thresholdDays });
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });

  // Admin: send test SMS to a specific phone number
  app.post("/api/admin/send-test-sms", requireAdmin, async (req, res) => {
    try {
      const { phone, message } = z.object({
        phone: z.string().min(10),
        message: z.string().min(1).max(320),
      }).parse(req.body);
      const ok = await sendSms(phone, message);
      res.json({ ok, phone });
    } catch (e: any) { res.status(400).json({ error: e.message }); }
  });

  // Admin: send inactivity SMS reminders (mirrors the email reminder logic)
  app.post("/api/admin/send-reminder-sms", requireAdmin, async (req, res) => {
    try {
      const { userId: targetUserId, thresholdDays: rawThreshold } = req.body;
      const thresholdDays = Number(rawThreshold) || 3;
      const now = new Date();
      const allUsers = targetUserId
        ? [await storage.getUserById(Number(targetUserId))].filter(Boolean)
        : await storage.getAllUsers();

      let sent = 0, skipped = 0, errors = 0;
      for (const u of allUsers as any[]) {
        try {
          if (u.email === 'track@sweetmo.io') { skipped++; continue; }
          if (!u.phone || !u.smsOptIn) { skipped++; continue; }
          const latest = await storage.getLatestDailyEntry(u.id);
          let daysSince: number | null = null;
          if (!latest) {
            const age = Math.floor((now.getTime() - new Date(u.createdAt).getTime()) / 86400000);
            if (age < thresholdDays) { skipped++; continue; }
          } else {
            daysSince = Math.floor((now.getTime() - new Date(latest.entryDate + 'T12:00:00Z').getTime()) / 86400000);
            if (daysSince < thresholdDays) { skipped++; continue; }
          }
          const ok = await sendDailyReminderSms({
            to: u.phone,
            displayName: u.displayName || u.email,
            daysSinceLastScore: daysSince,
          });
          if (ok) sent++; else errors++;
        } catch (err: any) { console.error(`[sms-reminder] ${u.email}:`, err?.message); errors++; }
      }
      res.json({ ok: true, sent, skipped, errors, thresholdDays });
    } catch (e: any) { res.status(500).json({ error: e.message }); }
  });

  // Coaching session request (Pro only)
  app.post("/api/coaching-request", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const isPro = await storage.isPro(userId);
      if (!isPro) return res.status(403).json({ error: "Coaching sessions are available to Pro subscribers only" });

      const user = await storage.getUserById(userId);
      if (!user) return res.status(404).json({ error: "User not found" });

      const { preferredDate, timezone, topic } = z.object({
        preferredDate: z.string().min(1, "Please provide a preferred date and time"),
        timezone: z.string().optional().default(""),
        topic: z.string().optional().default(""),
      }).parse(req.body);

      const name = user.firstName && user.lastName
        ? `${user.firstName} ${user.lastName}`
        : user.displayName || user.username;

      const request = await storage.createCoachingRequest({
        userId,
        name,
        email: user.email,
        preferredDate,
        timezone,
        topic,
      });

      // Send emails fire-and-forget
      sendCoachingRequestEmail({ userName: name, userEmail: user.email, preferredDate, timezone, topic }).catch(() => {});

      res.json({ ok: true, id: request.id });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
    }
  });

  // Globe — world score map (Pro-gated on frontend, auth required)
  app.get("/api/globe/scores", requireAuth, async (req, res) => {
    try {
      const allUsers = await storage.getAllUsers();
      const points = await Promise.all(
        allUsers.map(async (u) => {
          const [sched, latestEntry] = await Promise.all([
            storage.getUserSchedule(u.id),
            storage.getLatestDailyEntry(u.id),
          ]);
          if (!latestEntry) return null;

          const timezone = sched?.timezone || null;

          // Prefer dynamic geocoding (city+country); fall back to timezone coords
          let coords: [number, number] | null = await geocodeCity(u.city, u.country);
          if (!coords && timezone) {
            coords = getCoordsForTimezone(timezone);
          }
          if (!coords) return null;

          const scores = await storage.getMetricScoresByEntry(latestEntry.id);
          const wins = scores.filter(s => s.rating === "success").length;
          const losses = scores.filter(s => s.rating === "setback").length;
          const score = wins - losses;

          return {
            userId: u.id,
            displayName: u.displayName,
            firstName: u.firstName || null,
            lastName: u.lastName || null,
            timezone,
            city: u.city || null,
            region: u.region || null,
            country: u.country || null,
            coordinates: coords, // [lon, lat]
            score,
            wins,
            losses,
            date: latestEntry.entryDate,
          };
        })
      );
      res.json(points.filter(Boolean));
    } catch (e: any) {
      res.status(500).json({ error: e.message });
    }
  });
}
