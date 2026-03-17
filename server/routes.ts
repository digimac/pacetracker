import express, { type Express } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { stripe, createCheckoutSession, createBillingPortalSession, handleWebhook, PRICE_MONTHLY, PRICE_ANNUAL } from "./billing";
import { sendPasswordResetEmail } from "./email";
import { scryptSync, randomBytes, timingSafeEqual } from "crypto";
import { insertUserSchema, insertCustomMetricSchema, insertDailyEntrySchema, insertMetricScoreSchema, insertUserScheduleSchema } from "@shared/schema";
import { z } from "zod";

// Admin email — the one account with full admin privileges
const ADMIN_EMAIL = "admin@sweetmomentum.app";

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

export async function registerRoutes(httpServer: Server, app: Express): Promise<void> {
  // Auth: Register
  app.post("/api/auth/register", async (req, res) => {
    try {
      const data = insertUserSchema.parse(req.body);
      const existingEmail = await storage.getUserByEmail(data.email);
      if (existingEmail) return res.status(400).json({ error: "Email already registered" });
      const existingUsername = await storage.getUserByUsername(data.username);
      if (existingUsername) return res.status(400).json({ error: "Username already taken" });

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

      res.json({ user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName } });
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
      res.json({ user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName } });
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

  // Auth: Me
  app.get("/api/auth/me", async (req, res) => {
    if (!req.session?.userId) return res.status(401).json({ error: "Unauthorized" });
    const user = await storage.getUserById(req.session.userId);
    if (!user) return res.status(401).json({ error: "User not found" });
    res.json({ user: { id: user.id, email: user.email, username: user.username, displayName: user.displayName } });
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
        entry = await storage.createDailyEntry({ userId, entryDate: dateStr, notes: notes || null });
      } else if (notes !== undefined) {
        await storage.updateDailyEntry(entry.id, { notes });
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
        story: z.string().max(2000).optional().nullable(),
        imageUrl: z.string().url().optional().nullable().or(z.literal("")),
        quote: z.string().max(500).optional().nullable(),
        quoteAuthor: z.string().max(100).optional().nullable(),
      });
      const data = schema.parse(req.body);
      const result = await storage.upsertMetricContent({
        metricKey: data.metricKey,
        subtext: data.subtext || null,
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
}
