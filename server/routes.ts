import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { stripe, createCheckoutSession, createBillingPortalSession, handleWebhook, PRICE_MONTHLY, PRICE_ANNUAL } from "./billing";
import { sendPasswordResetEmail, sendFeedbackEmail, sendInviteEmail } from "./email";
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
      res.json({ user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, firstName: user.firstName, lastName: user.lastName, city: user.city, region: user.region, country: user.country, category: user.category ?? null } });
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
      res.json({ user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, firstName: user.firstName, lastName: user.lastName, city: user.city, region: user.region, country: user.country, category: user.category ?? null } });
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
    res.json({ user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, firstName: user.firstName, lastName: user.lastName, city: user.city, region: user.region, country: user.country, category: user.category ?? null } });
  });

  // Profile update — first name / last name
  app.patch("/api/auth/profile", requireAuth, async (req, res) => {
    try {
      const userId = req.session!.userId!;
      const { firstName, lastName, city, region, country, category } = z.object({
        firstName: z.string().max(100).optional().nullable(),
        lastName: z.string().max(100).optional().nullable(),
        city: z.string().max(100).optional().nullable(),
        region: z.string().max(100).optional().nullable(),
        country: z.string().max(100).optional().nullable(),
        category: z.string().max(50).optional().nullable(),
      }).parse(req.body);
      const user = await storage.updateUserProfile(userId, {
        firstName: firstName ?? null,
        lastName: lastName ?? null,
        city: city ?? null,
        region: region ?? null,
        country: country ?? null,
        category: category !== undefined ? (category ?? null) : undefined,
      });
      if (!user) return res.status(404).json({ error: "User not found" });
      res.json({ user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName, firstName: user.firstName, lastName: user.lastName, city: user.city, region: user.region, country: user.country, category: user.category ?? null } });
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
      const { scores, notes } = z.object({
        scores: z.array(z.object({
          metricKey: z.string(),
          metricLabel: z.string(),
          rating: z.enum(["success", "setback", "skip"]),
        })),
        notes: z.string().optional(),
      }).parse(req.body);

      let entry = await storage.getDailyEntry(userId, dateStr);
      if (!entry) {
        // Only persist notes on creation if something was actually written
        entry = await storage.createDailyEntry({ userId, entryDate: dateStr, notes: notes?.trim() || null });
      } else if (notes !== undefined) {
        // Only overwrite existing notes if the user typed something,
        // or explicitly sent null to clear — never overwrite with empty string
        if (notes.trim() !== "" || notes === null) {
          await storage.updateDailyEntry(entry.id, { notes: notes.trim() || null });
        }
      }

      const saved = await storage.upsertMetricScores(entry.id, userId, scores);
      res.json({ entry, scores: saved });
    } catch (e: any) {
      res.status(400).json({ error: e.message });
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
    const isPro = await storage.isPro(req.session!.userId!);
    res.json({
      isPro,
      plan: sub?.plan || "free",
      status: sub?.status || "inactive",
      currentPeriodEnd: sub?.currentPeriodEnd || null,
      prices: {
        monthly: PRICE_MONTHLY,
        annual: PRICE_ANNUAL,
        monthlyAmount: 999,
        annualAmount: 9900,
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
        currentPeriodEnd: new Date(Date.now() - 1000), // immediately expired
      });
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
      if (!["story", "tracking", "connect"].includes(pageKey)) {
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
