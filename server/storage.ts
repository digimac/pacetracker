import {
  User, InsertUser,
  CustomMetric, InsertCustomMetric,
  DailyEntry, InsertDailyEntry,
  MetricScore, InsertMetricScore,
  UserSchedule, InsertUserSchedule,
  Subscription, InsertSubscription,
  MetricContent, InsertMetricContent,
  PasswordResetToken,
  users, customMetrics, dailyEntries, metricScores, userSchedule, subscriptions, metricContent, passwordResetTokens,
} from "@shared/schema";
import { eq, and, gte, lte, asc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;

  // Custom Metrics
  getCustomMetricsByUser(userId: number): Promise<CustomMetric[]>;
  createCustomMetric(metric: InsertCustomMetric): Promise<CustomMetric>;
  updateCustomMetric(id: number, userId: number, updates: Partial<InsertCustomMetric>): Promise<CustomMetric | undefined>;
  deleteCustomMetric(id: number, userId: number): Promise<boolean>;

  // Daily Entries
  getDailyEntry(userId: number, date: string): Promise<DailyEntry | undefined>;
  getDailyEntriesByRange(userId: number, startDate: string, endDate: string): Promise<DailyEntry[]>;
  createDailyEntry(entry: InsertDailyEntry): Promise<DailyEntry>;
  updateDailyEntry(id: number, updates: Partial<InsertDailyEntry>): Promise<DailyEntry | undefined>;

  // Metric Scores
  getMetricScoresByEntry(entryId: number): Promise<MetricScore[]>;
  getMetricScoresByUserAndDate(userId: number, date: string): Promise<MetricScore[]>;
  upsertMetricScores(entryId: number, userId: number, scores: { metricKey: string; metricLabel: string; rating: string }[]): Promise<MetricScore[]>;

  // User Schedule
  getUserSchedule(userId: number): Promise<UserSchedule | undefined>;
  upsertUserSchedule(schedule: InsertUserSchedule & { userId: number }): Promise<UserSchedule>;

  // Subscriptions
  getSubscription(userId: number): Promise<Subscription | undefined>;
  upsertSubscription(data: Partial<Subscription> & { userId: number }): Promise<Subscription>;
  getSubscriptionByStripeCustomerId(customerId: string): Promise<Subscription | undefined>;
  isPro(userId: number): Promise<boolean>;

  // Metric Content
  getAllMetricContent(): Promise<MetricContent[]>;
  getMetricContent(metricKey: string): Promise<MetricContent | undefined>;
  upsertMetricContent(data: InsertMetricContent): Promise<MetricContent>;

  // Password Reset
  createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: number): Promise<void>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;
}

// ─── Drizzle (PostgreSQL) implementation ────────────────────────────────────

export class DrizzleStorage implements IStorage {
  private db: any;

  constructor(db: any) {
    this.db = db;
  }

  // Users
  async getUserById(id: number): Promise<User | undefined> {
    const rows = await this.db.select().from(users).where(eq(users.id, id)).limit(1);
    return rows[0];
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    const rows = await this.db.select().from(users).where(eq(users.email, email.toLowerCase())).limit(1);
    return rows[0];
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    const rows = await this.db.select().from(users).where(eq(users.username, username.toLowerCase())).limit(1);
    return rows[0];
  }

  async createUser(user: InsertUser): Promise<User> {
    const rows = await this.db.insert(users).values({
      ...user,
      email: user.email.toLowerCase(),
      username: user.username.toLowerCase(),
    }).returning();
    return rows[0];
  }

  async getAllUsers(): Promise<User[]> {
    return this.db.select().from(users).orderBy(asc(users.createdAt));
  }

  // Custom Metrics
  async getCustomMetricsByUser(userId: number): Promise<CustomMetric[]> {
    return this.db.select().from(customMetrics)
      .where(and(eq(customMetrics.userId, userId), eq(customMetrics.isActive, true)))
      .orderBy(asc(customMetrics.sortOrder));
  }

  async createCustomMetric(metric: InsertCustomMetric): Promise<CustomMetric> {
    const rows = await this.db.insert(customMetrics).values(metric).returning();
    return rows[0];
  }

  async updateCustomMetric(id: number, userId: number, updates: Partial<InsertCustomMetric>): Promise<CustomMetric | undefined> {
    const rows = await this.db.update(customMetrics)
      .set(updates)
      .where(and(eq(customMetrics.id, id), eq(customMetrics.userId, userId)))
      .returning();
    return rows[0];
  }

  async deleteCustomMetric(id: number, userId: number): Promise<boolean> {
    const rows = await this.db.update(customMetrics)
      .set({ isActive: false })
      .where(and(eq(customMetrics.id, id), eq(customMetrics.userId, userId)))
      .returning();
    return rows.length > 0;
  }

  // Daily Entries
  async getDailyEntry(userId: number, date: string): Promise<DailyEntry | undefined> {
    const rows = await this.db.select().from(dailyEntries)
      .where(and(eq(dailyEntries.userId, userId), eq(dailyEntries.entryDate, date)))
      .limit(1);
    return rows[0];
  }

  async getDailyEntriesByRange(userId: number, startDate: string, endDate: string): Promise<DailyEntry[]> {
    return this.db.select().from(dailyEntries)
      .where(and(
        eq(dailyEntries.userId, userId),
        gte(dailyEntries.entryDate, startDate),
        lte(dailyEntries.entryDate, endDate),
      ))
      .orderBy(asc(dailyEntries.entryDate));
  }

  async createDailyEntry(entry: InsertDailyEntry): Promise<DailyEntry> {
    const rows = await this.db.insert(dailyEntries).values(entry).returning();
    return rows[0];
  }

  async updateDailyEntry(id: number, updates: Partial<InsertDailyEntry>): Promise<DailyEntry | undefined> {
    const rows = await this.db.update(dailyEntries)
      .set({ ...updates, updatedAt: new Date() })
      .where(eq(dailyEntries.id, id))
      .returning();
    return rows[0];
  }

  // Metric Scores
  async getMetricScoresByEntry(entryId: number): Promise<MetricScore[]> {
    return this.db.select().from(metricScores).where(eq(metricScores.entryId, entryId));
  }

  async getMetricScoresByUserAndDate(userId: number, date: string): Promise<MetricScore[]> {
    const entry = await this.getDailyEntry(userId, date);
    if (!entry) return [];
    return this.getMetricScoresByEntry(entry.id);
  }

  async upsertMetricScores(entryId: number, userId: number, scores: { metricKey: string; metricLabel: string; rating: string }[]): Promise<MetricScore[]> {
    // Delete existing scores for this entry, then re-insert
    await this.db.delete(metricScores).where(eq(metricScores.entryId, entryId));
    if (scores.length === 0) return [];
    const rows = await this.db.insert(metricScores)
      .values(scores.map(s => ({ entryId, userId, metricKey: s.metricKey, metricLabel: s.metricLabel, rating: s.rating })))
      .returning();
    return rows;
  }

  // User Schedule
  async getUserSchedule(userId: number): Promise<UserSchedule | undefined> {
    const rows = await this.db.select().from(userSchedule).where(eq(userSchedule.userId, userId)).limit(1);
    return rows[0];
  }

  async upsertUserSchedule(schedule: InsertUserSchedule & { userId: number }): Promise<UserSchedule> {
    const rows = await this.db.insert(userSchedule)
      .values({ ...schedule, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: userSchedule.userId,
        set: { ...schedule, updatedAt: new Date() },
      })
      .returning();
    return rows[0];
  }

  // Subscriptions
  async getSubscription(userId: number): Promise<Subscription | undefined> {
    const rows = await this.db.select().from(subscriptions).where(eq(subscriptions.userId, userId)).limit(1);
    return rows[0];
  }

  async upsertSubscription(data: Partial<Subscription> & { userId: number }): Promise<Subscription> {
    const rows = await this.db.insert(subscriptions)
      .values({
        userId: data.userId,
        stripeCustomerId: data.stripeCustomerId ?? null,
        stripeSubscriptionId: data.stripeSubscriptionId ?? null,
        stripePriceId: data.stripePriceId ?? null,
        plan: data.plan ?? "free",
        status: data.status ?? "inactive",
        currentPeriodEnd: data.currentPeriodEnd ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: {
          ...(data.stripeCustomerId !== undefined && { stripeCustomerId: data.stripeCustomerId }),
          ...(data.stripeSubscriptionId !== undefined && { stripeSubscriptionId: data.stripeSubscriptionId }),
          ...(data.stripePriceId !== undefined && { stripePriceId: data.stripePriceId }),
          ...(data.plan !== undefined && { plan: data.plan }),
          ...(data.status !== undefined && { status: data.status }),
          ...(data.currentPeriodEnd !== undefined && { currentPeriodEnd: data.currentPeriodEnd }),
          updatedAt: new Date(),
        },
      })
      .returning();
    return rows[0];
  }

  async getSubscriptionByStripeCustomerId(customerId: string): Promise<Subscription | undefined> {
    const rows = await this.db.select().from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .limit(1);
    return rows[0];
  }

  async isPro(userId: number): Promise<boolean> {
    const sub = await this.getSubscription(userId);
    if (!sub) return false;
    return sub.status === "active" && sub.plan !== "free";
  }

  // Metric Content
  async getAllMetricContent(): Promise<MetricContent[]> {
    return this.db.select().from(metricContent);
  }

  async getMetricContent(key: string): Promise<MetricContent | undefined> {
    const rows = await this.db.select().from(metricContent).where(eq(metricContent.metricKey, key)).limit(1);
    return rows[0];
  }

  async upsertMetricContent(data: InsertMetricContent): Promise<MetricContent> {
    const rows = await this.db.insert(metricContent)
      .values({ ...data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: metricContent.metricKey,
        set: {
          subtext: data.subtext,
          story: data.story,
          imageUrl: data.imageUrl,
          quote: data.quote,
          quoteAuthor: data.quoteAuthor,
          updatedAt: new Date(),
        },
      })
      .returning();
    return rows[0];
  }

  // Password Reset
  async createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const rows = await this.db.insert(passwordResetTokens)
      .values({ userId, token, expiresAt })
      .returning();
    return rows[0];
  }

  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    const rows = await this.db.select().from(passwordResetTokens)
      .where(eq(passwordResetTokens.token, token))
      .limit(1);
    return rows[0];
  }

  async markPasswordResetTokenUsed(id: number): Promise<void> {
    await this.db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, id));
  }

  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    await this.db.update(users)
      .set({ password: hashedPassword })
      .where(eq(users.id, userId));
  }
}

// ─── In-memory fallback (used in local dev without DATABASE_URL) ─────────────

export class MemStorage implements IStorage {
  private usersMap: Map<number, User> = new Map();
  private customMetrics: Map<number, CustomMetric> = new Map();
  private dailyEntries: Map<number, DailyEntry> = new Map();
  private metricScores: Map<number, MetricScore> = new Map();
  private userSchedules: Map<number, UserSchedule> = new Map();
  private subscriptionsMap: Map<number, Subscription> = new Map();
  private subscriptionIdCounter = 1;
  private userIdCounter = 1;
  private customMetricIdCounter = 1;
  private dailyEntryIdCounter = 1;
  private metricScoreIdCounter = 1;
  private userScheduleIdCounter = 1;

  constructor() {
    this.seedDemoUser();
  }

  private async seedDemoUser() {
    const { scryptSync, randomBytes } = await import("crypto");
    const salt = randomBytes(16).toString("hex");
    const hash = scryptSync("demo1234", salt, 64).toString("hex");
    const password = `${hash}.${salt}`;

    const user: User = {
      id: this.userIdCounter++,
      email: "demo@pacetracker.app",
      username: "demo",
      password,
      displayName: "Demo User",
      createdAt: new Date(),
    };
    this.usersMap.set(user.id, user);

    const schedule: UserSchedule = {
      id: this.userScheduleIdCounter++,
      userId: user.id,
      wakeTime: "06:00",
      sleepTime: "22:00",
      workStartTime: "09:00",
      workEndTime: "17:00",
      timezone: "America/New_York",
      dailyGoal: "Execute with focus across all six daily metrics.",
      updatedAt: new Date(),
    };
    this.userSchedules.set(user.id, schedule);

    const today = new Date();
    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      const dateStr = d.toISOString().split("T")[0];
      const entry: DailyEntry = {
        id: this.dailyEntryIdCounter++,
        userId: user.id,
        entryDate: dateStr,
        notes: i === 0 ? "Great start today." : null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      this.dailyEntries.set(entry.id, entry);
      const coreMetrics = ["TIME", "GOAL", "TEAM", "TASK", "VIEW", "PACE"];
      coreMetrics.forEach((key) => {
        const score: MetricScore = {
          id: this.metricScoreIdCounter++,
          entryId: entry.id,
          userId: user.id,
          metricKey: key,
          metricLabel: key,
          rating: i === 0 ? "skip" : (Math.random() > 0.25 ? "success" : "setback"),
        };
        this.metricScores.set(score.id, score);
      });
    }
  }

  async getUserById(id: number): Promise<User | undefined> { return this.usersMap.get(id); }
  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.usersMap.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
  }
  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.usersMap.values()).find(u => u.username.toLowerCase() === username.toLowerCase());
  }
  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = { ...user, id: this.userIdCounter++, createdAt: new Date() };
    this.usersMap.set(newUser.id, newUser);
    return newUser;
  }
  async getAllUsers(): Promise<User[]> {
    return Array.from(this.usersMap.values()).sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
  }
  async getCustomMetricsByUser(userId: number): Promise<CustomMetric[]> {
    return Array.from(this.customMetrics.values()).filter(m => m.userId === userId && m.isActive);
  }
  async createCustomMetric(metric: InsertCustomMetric): Promise<CustomMetric> {
    const newMetric: CustomMetric = { ...metric, id: this.customMetricIdCounter++ };
    this.customMetrics.set(newMetric.id, newMetric);
    return newMetric;
  }
  async updateCustomMetric(id: number, userId: number, updates: Partial<InsertCustomMetric>): Promise<CustomMetric | undefined> {
    const metric = this.customMetrics.get(id);
    if (!metric || metric.userId !== userId) return undefined;
    const updated = { ...metric, ...updates };
    this.customMetrics.set(id, updated);
    return updated;
  }
  async deleteCustomMetric(id: number, userId: number): Promise<boolean> {
    const metric = this.customMetrics.get(id);
    if (!metric || metric.userId !== userId) return false;
    this.customMetrics.set(id, { ...metric, isActive: false });
    return true;
  }
  async getDailyEntry(userId: number, date: string): Promise<DailyEntry | undefined> {
    return Array.from(this.dailyEntries.values()).find(e => e.userId === userId && e.entryDate === date);
  }
  async getDailyEntriesByRange(userId: number, startDate: string, endDate: string): Promise<DailyEntry[]> {
    return Array.from(this.dailyEntries.values())
      .filter(e => e.userId === userId && e.entryDate >= startDate && e.entryDate <= endDate)
      .sort((a, b) => a.entryDate.localeCompare(b.entryDate));
  }
  async createDailyEntry(entry: InsertDailyEntry): Promise<DailyEntry> {
    const newEntry: DailyEntry = { ...entry, id: this.dailyEntryIdCounter++, createdAt: new Date(), updatedAt: new Date() };
    this.dailyEntries.set(newEntry.id, newEntry);
    return newEntry;
  }
  async updateDailyEntry(id: number, updates: Partial<InsertDailyEntry>): Promise<DailyEntry | undefined> {
    const entry = this.dailyEntries.get(id);
    if (!entry) return undefined;
    const updated = { ...entry, ...updates, updatedAt: new Date() };
    this.dailyEntries.set(id, updated);
    return updated;
  }
  async getMetricScoresByEntry(entryId: number): Promise<MetricScore[]> {
    return Array.from(this.metricScores.values()).filter(s => s.entryId === entryId);
  }
  async getMetricScoresByUserAndDate(userId: number, date: string): Promise<MetricScore[]> {
    const entry = await this.getDailyEntry(userId, date);
    if (!entry) return [];
    return this.getMetricScoresByEntry(entry.id);
  }
  async upsertMetricScores(entryId: number, userId: number, scores: { metricKey: string; metricLabel: string; rating: string }[]): Promise<MetricScore[]> {
    const toDelete = Array.from(this.metricScores.values()).filter(s => s.entryId === entryId);
    toDelete.forEach(s => this.metricScores.delete(s.id));
    const newScores: MetricScore[] = scores.map(s => ({
      id: this.metricScoreIdCounter++,
      entryId,
      userId,
      metricKey: s.metricKey,
      metricLabel: s.metricLabel,
      rating: s.rating,
    }));
    newScores.forEach(s => this.metricScores.set(s.id, s));
    return newScores;
  }
  async getSubscription(userId: number): Promise<Subscription | undefined> { return this.subscriptionsMap.get(userId); }
  async upsertSubscription(data: Partial<Subscription> & { userId: number }): Promise<Subscription> {
    const existing = this.subscriptionsMap.get(data.userId);
    if (existing) {
      const updated: Subscription = { ...existing, ...data, updatedAt: new Date() };
      this.subscriptionsMap.set(data.userId, updated);
      return updated;
    }
    const newSub: Subscription = {
      id: this.subscriptionIdCounter++,
      userId: data.userId,
      stripeCustomerId: data.stripeCustomerId || null,
      stripeSubscriptionId: data.stripeSubscriptionId || null,
      stripePriceId: data.stripePriceId || null,
      plan: data.plan || "free",
      status: data.status || "inactive",
      currentPeriodEnd: data.currentPeriodEnd || null,
      updatedAt: new Date(),
    };
    this.subscriptionsMap.set(data.userId, newSub);
    return newSub;
  }
  async getSubscriptionByStripeCustomerId(customerId: string): Promise<Subscription | undefined> {
    return Array.from(this.subscriptionsMap.values()).find(s => s.stripeCustomerId === customerId);
  }
  async isPro(userId: number): Promise<boolean> {
    const sub = this.subscriptionsMap.get(userId);
    if (!sub) return false;
    return sub.status === "active" && sub.plan !== "free";
  }

  // Metric Content (in-memory)
  private metricContentMap: Map<string, MetricContent> = new Map();
  private metricContentIdCounter = 1;

  async getAllMetricContent(): Promise<MetricContent[]> {
    return Array.from(this.metricContentMap.values());
  }
  async getMetricContent(key: string): Promise<MetricContent | undefined> {
    return this.metricContentMap.get(key);
  }
  async upsertMetricContent(data: InsertMetricContent): Promise<MetricContent> {
    const existing = this.metricContentMap.get(data.metricKey);
    const merged: MetricContent = {
      id: existing?.id ?? this.metricContentIdCounter++,
      metricKey: data.metricKey,
      subtext: data.subtext ?? null,
      story: data.story ?? null,
      imageUrl: data.imageUrl ?? null,
      quote: data.quote ?? null,
      quoteAuthor: data.quoteAuthor ?? null,
      updatedAt: new Date(),
    };
    this.metricContentMap.set(data.metricKey, merged);
    return merged;
  }

  // Password Reset (in-memory)
  private resetTokens: Map<number, PasswordResetToken> = new Map();
  private resetTokenIdCounter = 1;
  async createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<PasswordResetToken> {
    const rec: PasswordResetToken = { id: this.resetTokenIdCounter++, userId, token, expiresAt, usedAt: null, createdAt: new Date() };
    this.resetTokens.set(rec.id, rec);
    return rec;
  }
  async getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined> {
    return Array.from(this.resetTokens.values()).find(t => t.token === token);
  }
  async markPasswordResetTokenUsed(id: number): Promise<void> {
    const t = this.resetTokens.get(id);
    if (t) this.resetTokens.set(id, { ...t, usedAt: new Date() });
  }
  async updateUserPassword(userId: number, hashedPassword: string): Promise<void> {
    const user = this.usersMap.get(userId);
    if (user) this.usersMap.set(userId, { ...user, password: hashedPassword });
  }

  async getUserSchedule(userId: number): Promise<UserSchedule | undefined> { return this.userSchedules.get(userId); }
  async upsertUserSchedule(schedule: InsertUserSchedule & { userId: number }): Promise<UserSchedule> {
    const existing = this.userSchedules.get(schedule.userId);
    if (existing) {
      const updated: UserSchedule = { ...existing, ...schedule, updatedAt: new Date() };
      this.userSchedules.set(schedule.userId, updated);
      return updated;
    }
    const newSchedule: UserSchedule = { ...schedule, id: this.userScheduleIdCounter++, updatedAt: new Date() };
    this.userSchedules.set(schedule.userId, newSchedule);
    return newSchedule;
  }
}

// ─── Export the right implementation based on environment ────────────────────

function createStorage(): IStorage {
  if (process.env.DATABASE_URL) {
    const { db } = require("./db");
    console.log("[storage] Using PostgreSQL (DrizzleStorage)");
    return new DrizzleStorage(db);
  }
  console.log("[storage] DATABASE_URL not set — using MemStorage (data resets on restart)");
  return new MemStorage();
}

export const storage = createStorage();
