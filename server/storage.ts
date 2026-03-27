import {
  User, InsertUser,
  CustomMetric, InsertCustomMetric,
  DailyEntry, InsertDailyEntry,
  MetricScore, InsertMetricScore,
  UserSchedule, InsertUserSchedule,
  Subscription, InsertSubscription,
  MetricContent, InsertMetricContent,
  SitePage, InsertSitePage,
  PasswordResetToken,
  Invite, InsertInvite,
  Connection,
  EmailTemplate,
  CoachingRequest, coachingRequests,
  users, customMetrics, dailyEntries, metricScores, userSchedule, subscriptions, metricContent, sitePages, passwordResetTokens, invites, connections, emailTemplates,
} from "@shared/schema";
import { eq, and, gte, lte, asc, desc } from "drizzle-orm";

export interface IStorage {
  // Users
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  updateUserProfile(userId: number, updates: { firstName?: string | null; lastName?: string | null; city?: string | null; region?: string | null; country?: string | null; category?: string | null; phone?: string | null }): Promise<User | undefined>;
  deleteUser(userId: number): Promise<void>;

  // Custom Metrics
  getCustomMetricsByUser(userId: number): Promise<CustomMetric[]>;
  createCustomMetric(metric: InsertCustomMetric): Promise<CustomMetric>;
  updateCustomMetric(id: number, userId: number, updates: Partial<InsertCustomMetric>): Promise<CustomMetric | undefined>;
  deleteCustomMetric(id: number, userId: number): Promise<boolean>;

  // Daily Entries
  getDailyEntry(userId: number, date: string): Promise<DailyEntry | undefined>;
  getLatestDailyEntry(userId: number): Promise<DailyEntry | undefined>;
  getDailyEntriesByRange(userId: number, startDate: string, endDate: string): Promise<DailyEntry[]>;
  createDailyEntry(entry: InsertDailyEntry): Promise<DailyEntry>;
  updateDailyEntry(id: number, updates: Partial<InsertDailyEntry>): Promise<DailyEntry | undefined>;

  // Metric Scores
  getMetricScoresByEntry(entryId: number): Promise<MetricScore[]>;
  getMetricScoresByUserAndDate(userId: number, date: string): Promise<MetricScore[]>;
  upsertMetricScores(entryId: number, userId: number, scores: { metricKey: string; metricLabel: string; rating: string }[]): Promise<MetricScore[]>;
  upsertSingleMetricScore(entryId: number, userId: number, score: { metricKey: string; metricLabel: string; rating: string }): Promise<MetricScore>;

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

  // Site Pages
  getSitePage(pageKey: string): Promise<SitePage | undefined>;
  getAllSitePages(): Promise<SitePage[]>;
  upsertSitePage(data: InsertSitePage): Promise<SitePage>;

  // Password Reset
  createPasswordResetToken(userId: number, token: string, expiresAt: Date): Promise<PasswordResetToken>;
  getPasswordResetToken(token: string): Promise<PasswordResetToken | undefined>;
  markPasswordResetTokenUsed(id: number): Promise<void>;
  updateUserPassword(userId: number, hashedPassword: string): Promise<void>;

  // Invites & Connections
  createInvite(data: InsertInvite): Promise<Invite>;
  getInviteByToken(token: string): Promise<Invite | undefined>;
  getInvitesBySender(userId: number): Promise<Invite[]>;
  updateInviteStatus(id: number, status: string, acceptedByUserId?: number): Promise<void>;
  createConnection(userId: number, partnerId: number, inviteId?: number): Promise<Connection>;
  getConnectionsByUser(userId: number): Promise<Connection[]>;
  removeConnection(userId: number, partnerId: number): Promise<void>;
  getPartnerDailyScore(partnerId: number, date: string): Promise<{ score: number; notes: string | null } | null>;
  // Coaching requests
  createCoachingRequest(data: { userId: number; name: string; email: string; preferredDate: string; timezone: string; topic: string }): Promise<CoachingRequest>;

  // Email templates
  getEmailTemplate(key: string): Promise<EmailTemplate | undefined>;
  upsertEmailTemplate(key: string, subject: string, bodyHtml: string, bodyText: string): Promise<EmailTemplate>;
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

  async updateUserProfile(userId: number, updates: { firstName?: string | null; lastName?: string | null; city?: string | null; region?: string | null; country?: string | null; category?: string | null; phone?: string | null }): Promise<User | undefined> {
    const rows = await this.db.update(users).set(updates).where(eq(users.id, userId)).returning();
    return rows[0];
  }

  async deleteUser(userId: number): Promise<void> {
    // Delete all related data in dependency order, then the user
    await this.db.delete(connections).where(eq(connections.userId, userId));
    await this.db.delete(connections).where(eq(connections.partnerId, userId));
    await this.db.delete(invites).where(eq(invites.senderId, userId));
    await this.db.delete(metricScores).where(eq(metricScores.userId, userId));
    await this.db.delete(dailyEntries).where(eq(dailyEntries.userId, userId));
    await this.db.delete(customMetrics).where(eq(customMetrics.userId, userId));
    await this.db.delete(userSchedule).where(eq(userSchedule.userId, userId));
    await this.db.delete(subscriptions).where(eq(subscriptions.userId, userId));
    await this.db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, userId));
    await this.db.delete(users).where(eq(users.id, userId));
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

  async getLatestDailyEntry(userId: number): Promise<DailyEntry | undefined> {
    const rows = await this.db.select().from(dailyEntries)
      .where(eq(dailyEntries.userId, userId))
      .orderBy(desc(dailyEntries.entryDate))
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
    if (scores.length === 0) return [];
    // For each score: update rating + ratedAt if a row already exists for this entryId+metricKey,
    // otherwise insert fresh. This preserves the ratedAt of each metric independently.
    const results: MetricScore[] = [];
    for (const s of scores) {
      const existing = await this.db.select().from(metricScores)
        .where(and(eq(metricScores.entryId, entryId), eq(metricScores.metricKey, s.metricKey)))
        .limit(1);
      if (existing.length > 0) {
        // Preserve ratedAt — only update rating/label (ratedAt was set when user first tapped)
        const [updated] = await this.db.update(metricScores)
          .set({ rating: s.rating, metricLabel: s.metricLabel })
          .where(eq(metricScores.id, existing[0].id))
          .returning();
        results.push(updated);
      } else {
        const [inserted] = await this.db.insert(metricScores)
          .values({ entryId, userId, metricKey: s.metricKey, metricLabel: s.metricLabel, rating: s.rating, ratedAt: new Date() })
          .returning();
        results.push(inserted);
      }
    }
    return results;
  }

  async upsertSingleMetricScore(entryId: number, userId: number, score: { metricKey: string; metricLabel: string; rating: string }): Promise<MetricScore> {
    const existing = await this.db.select().from(metricScores)
      .where(and(eq(metricScores.entryId, entryId), eq(metricScores.metricKey, score.metricKey)))
      .limit(1);
    if (existing.length > 0) {
      const [updated] = await this.db.update(metricScores)
        .set({ rating: score.rating, metricLabel: score.metricLabel, ratedAt: new Date() })
        .where(eq(metricScores.id, existing[0].id))
        .returning();
      return updated;
    } else {
      const [inserted] = await this.db.insert(metricScores)
        .values({ entryId, userId, metricKey: score.metricKey, metricLabel: score.metricLabel, rating: score.rating, ratedAt: new Date() })
        .returning();
      return inserted;
    }
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
          prompt: data.prompt,
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

  // Site Pages
  async getSitePage(pageKey: string): Promise<SitePage | undefined> {
    const rows = await this.db.select().from(sitePages).where(eq(sitePages.pageKey, pageKey)).limit(1);
    return rows[0];
  }
  async getAllSitePages(): Promise<SitePage[]> {
    return this.db.select().from(sitePages);
  }
  async upsertSitePage(data: InsertSitePage): Promise<SitePage> {
    const rows = await this.db.insert(sitePages)
      .values({ ...data, updatedAt: new Date() })
      .onConflictDoUpdate({
        target: sitePages.pageKey,
        set: {
          title: data.title,
          subtitle: data.subtitle,
          heroImageUrl: data.heroImageUrl,
          body: data.body,
          sections: data.sections,
          contactEmail: data.contactEmail,
          socialLinks: data.socialLinks,
          ctaLabel: data.ctaLabel,
          ctaUrl: data.ctaUrl,
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

  // ── Invites & Connections (Drizzle) ─────────────────────────────────────────
  async createInvite(data: InsertInvite): Promise<Invite> {
    const [row] = await this.db.insert(invites).values(data).returning();
    return row;
  }
  async getInviteByToken(token: string): Promise<Invite | undefined> {
    const [row] = await this.db.select().from(invites).where(eq(invites.token, token)).limit(1);
    return row;
  }
  async getInvitesBySender(userId: number): Promise<Invite[]> {
    return this.db.select().from(invites).where(eq(invites.senderId, userId)).orderBy(desc(invites.createdAt));
  }
  async updateInviteStatus(id: number, status: string, acceptedByUserId?: number): Promise<void> {
    await this.db.update(invites)
      .set({ status, ...(acceptedByUserId ? { acceptedByUserId } : {}) })
      .where(eq(invites.id, id));
  }
  async createConnection(userId: number, partnerId: number, inviteId?: number): Promise<Connection> {
    const [row] = await this.db.insert(connections).values({ userId, partnerId, inviteId }).returning();
    return row;
  }
  async getConnectionsByUser(userId: number): Promise<Connection[]> {
    // Return connections where user is either sender or acceptor
    const sent = await this.db.select().from(connections).where(eq(connections.userId, userId));
    const received = await this.db.select().from(connections).where(eq(connections.partnerId, userId));
    return [...sent, ...received];
  }
  async removeConnection(userId: number, partnerId: number): Promise<void> {
    await this.db.delete(connections)
      .where(and(eq(connections.userId, userId), eq(connections.partnerId, partnerId)));
    await this.db.delete(connections)
      .where(and(eq(connections.userId, partnerId), eq(connections.partnerId, userId)));
  }
  async getPartnerDailyScore(partnerId: number, date: string): Promise<{ score: number; notes: string | null } | null> {
    const entry = await this.getDailyEntry(partnerId, date);
    if (!entry) return null;
    const scores = await this.getMetricScoresByEntry(entry.id);
    const successes = scores.filter(s => s.rating === "success").length;
    const setbacks = scores.filter(s => s.rating === "setback").length;
    if (successes === 0 && setbacks === 0) return null; // no scores recorded yet
    return { score: successes - setbacks, notes: entry.notes };
  }
  async createCoachingRequest(data: { userId: number; name: string; email: string; preferredDate: string; timezone: string; topic: string }): Promise<CoachingRequest> {
    const [row] = await this.db.insert(coachingRequests).values(data).returning();
    return row;
  }

  async getEmailTemplate(key: string): Promise<EmailTemplate | undefined> {
    const [row] = await this.db.select().from(emailTemplates).where(eq(emailTemplates.key, key));
    return row;
  }
  async upsertEmailTemplate(key: string, subject: string, bodyHtml: string, bodyText: string): Promise<EmailTemplate> {
    const existing = await this.getEmailTemplate(key);
    if (existing) {
      const [row] = await this.db.update(emailTemplates)
        .set({ subject, bodyHtml, bodyText, updatedAt: new Date() })
        .where(eq(emailTemplates.key, key))
        .returning();
      return row;
    }
    const [row] = await this.db.insert(emailTemplates).values({ key, subject, bodyHtml, bodyText }).returning();
    return row;
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
  async updateUserProfile(userId: number, updates: { firstName?: string | null; lastName?: string | null; city?: string | null; region?: string | null; country?: string | null; category?: string | null; phone?: string | null }): Promise<User | undefined> {
    const user = this.usersMap.get(userId);
    if (!user) return undefined;
    const updated = { ...user, ...updates };
    this.usersMap.set(userId, updated);
    return updated;
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
  async getLatestDailyEntry(userId: number): Promise<DailyEntry | undefined> {
    const entries = Array.from(this.dailyEntries.values())
      .filter(e => e.userId === userId)
      .sort((a, b) => b.entryDate.localeCompare(a.entryDate));
    return entries[0];
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
    const results: MetricScore[] = [];
    for (const s of scores) {
      const existing = Array.from(this.metricScores.values()).find(r => r.entryId === entryId && r.metricKey === s.metricKey);
      if (existing) {
        // Preserve ratedAt — only update rating/label
        const updated = { ...existing, rating: s.rating, metricLabel: s.metricLabel };
        this.metricScores.set(existing.id, updated);
        results.push(updated);
      } else {
        const rec: MetricScore = { id: this.metricScoreIdCounter++, entryId, userId, metricKey: s.metricKey, metricLabel: s.metricLabel, rating: s.rating, ratedAt: new Date() };
        this.metricScores.set(rec.id, rec);
        results.push(rec);
      }
    }
    return results;
  }
  async upsertSingleMetricScore(entryId: number, userId: number, score: { metricKey: string; metricLabel: string; rating: string }): Promise<MetricScore> {
    const existing = Array.from(this.metricScores.values()).find(s => s.entryId === entryId && s.metricKey === score.metricKey);
    if (existing) {
      const updated = { ...existing, rating: score.rating, metricLabel: score.metricLabel, ratedAt: new Date() };
      this.metricScores.set(existing.id, updated);
      return updated;
    }
    const rec: MetricScore = { id: this.metricScoreIdCounter++, entryId, userId, metricKey: score.metricKey, metricLabel: score.metricLabel, rating: score.rating, ratedAt: new Date() };
    this.metricScores.set(rec.id, rec);
    return rec;
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
      prompt: data.prompt ?? null,
      story: data.story ?? null,
      imageUrl: data.imageUrl ?? null,
      quote: data.quote ?? null,
      quoteAuthor: data.quoteAuthor ?? null,
      updatedAt: new Date(),
    };
    this.metricContentMap.set(data.metricKey, merged);
    return merged;
  }

  // Site Pages (in-memory)
  private sitePagesMap: Map<string, SitePage> = new Map();
  private sitePageIdCounter = 1;
  async getSitePage(pageKey: string): Promise<SitePage | undefined> { return this.sitePagesMap.get(pageKey); }
  async getAllSitePages(): Promise<SitePage[]> { return Array.from(this.sitePagesMap.values()); }
  async upsertSitePage(data: InsertSitePage): Promise<SitePage> {
    const existing = this.sitePagesMap.get(data.pageKey);
    const page: SitePage = { ...existing, ...data, id: existing?.id ?? this.sitePageIdCounter++, updatedAt: new Date() } as SitePage;
    this.sitePagesMap.set(data.pageKey, page);
    return page;
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

  // Invites & Connections (in-memory stubs)
  private invitesMap: Map<number, Invite> = new Map();
  private inviteIdCounter = 1;
  private connectionsArr: Connection[] = [];
  private connectionIdCounter = 1;
  async createInvite(data: InsertInvite): Promise<Invite> {
    const rec: Invite = { id: this.inviteIdCounter++, ...data, status: data.status ?? "pending", inviteeEmail: data.inviteeEmail ?? null, inviteePhone: data.inviteePhone ?? null, message: data.message ?? null, acceptedByUserId: data.acceptedByUserId ?? null, createdAt: new Date() };
    this.invitesMap.set(rec.id, rec);
    return rec;
  }
  async getInviteByToken(token: string): Promise<Invite | undefined> {
    return Array.from(this.invitesMap.values()).find(i => i.token === token);
  }
  async getInvitesBySender(userId: number): Promise<Invite[]> {
    return Array.from(this.invitesMap.values()).filter(i => i.senderId === userId);
  }
  async updateInviteStatus(id: number, status: string, acceptedByUserId?: number): Promise<void> {
    const inv = this.invitesMap.get(id);
    if (inv) this.invitesMap.set(id, { ...inv, status, acceptedByUserId: acceptedByUserId ?? inv.acceptedByUserId });
  }
  async createConnection(userId: number, partnerId: number, inviteId?: number): Promise<Connection> {
    const rec: Connection = { id: this.connectionIdCounter++, userId, partnerId, inviteId: inviteId ?? null, createdAt: new Date() };
    this.connectionsArr.push(rec);
    return rec;
  }
  async getConnectionsByUser(userId: number): Promise<Connection[]> {
    return this.connectionsArr.filter(c => c.userId === userId || c.partnerId === userId);
  }
  async removeConnection(userId: number, partnerId: number): Promise<void> {
    this.connectionsArr = this.connectionsArr.filter(c =>
      !((c.userId === userId && c.partnerId === partnerId) || (c.userId === partnerId && c.partnerId === userId))
    );
  }
  async getPartnerDailyScore(partnerId: number, date: string): Promise<{ score: number; notes: string | null } | null> {
    const entry = await this.getDailyEntry(partnerId, date);
    if (!entry) return null;
    const scores = await this.getMetricScoresByEntry(entry.id);
    const successes = scores.filter(s => s.rating === "success").length;
    const setbacks = scores.filter(s => s.rating === "setback").length;
    if (successes === 0 && setbacks === 0) return null;
    return { score: successes - setbacks, notes: entry.notes };
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
  private emailTemplatesMap: Map<string, EmailTemplate> = new Map();
  async createCoachingRequest(data: { userId: number; name: string; email: string; preferredDate: string; timezone: string; topic: string }): Promise<CoachingRequest> {
    const [row] = await this.db.insert(coachingRequests).values(data).returning();
    return row;
  }

  async getEmailTemplate(key: string): Promise<EmailTemplate | undefined> {
    return this.emailTemplatesMap.get(key);
  }
  async upsertEmailTemplate(key: string, subject: string, bodyHtml: string, bodyText: string): Promise<EmailTemplate> {
    const t: EmailTemplate = { id: this.emailTemplatesMap.size + 1, key, subject, bodyHtml, bodyText, updatedAt: new Date() };
    this.emailTemplatesMap.set(key, t);
    return t;
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
