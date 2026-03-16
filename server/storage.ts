import {
  User, InsertUser,
  CustomMetric, InsertCustomMetric,
  DailyEntry, InsertDailyEntry,
  MetricScore, InsertMetricScore,
  UserSchedule, InsertUserSchedule,
  Subscription, InsertSubscription,
} from "@shared/schema";

export interface IStorage {
  // Users
  getUserById(id: number): Promise<User | undefined>;
  getUserByEmail(email: string): Promise<User | undefined>;
  getUserByUsername(username: string): Promise<User | undefined>;
  createUser(user: InsertUser): Promise<User>;

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
}

export class MemStorage implements IStorage {
  private users: Map<number, User> = new Map();
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
    // Seed a demo user
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
    this.users.set(user.id, user);

    // Seed schedule
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

    // Seed 7 days of example data
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
      const ratings = ["success", "success", "success", "success", "setback", "success"];
      coreMetrics.forEach((key, idx) => {
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

  // Users
  async getUserById(id: number): Promise<User | undefined> {
    return this.users.get(id);
  }

  async getUserByEmail(email: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.email.toLowerCase() === email.toLowerCase());
  }

  async getUserByUsername(username: string): Promise<User | undefined> {
    return Array.from(this.users.values()).find(u => u.username.toLowerCase() === username.toLowerCase());
  }

  async createUser(user: InsertUser): Promise<User> {
    const newUser: User = { ...user, id: this.userIdCounter++, createdAt: new Date() };
    this.users.set(newUser.id, newUser);
    return newUser;
  }

  // Custom Metrics
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

  // Daily Entries
  async getDailyEntry(userId: number, date: string): Promise<DailyEntry | undefined> {
    return Array.from(this.dailyEntries.values()).find(e => e.userId === userId && e.entryDate === date);
  }

  async getDailyEntriesByRange(userId: number, startDate: string, endDate: string): Promise<DailyEntry[]> {
    return Array.from(this.dailyEntries.values()).filter(e =>
      e.userId === userId && e.entryDate >= startDate && e.entryDate <= endDate
    ).sort((a, b) => a.entryDate.localeCompare(b.entryDate));
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

  // Metric Scores
  async getMetricScoresByEntry(entryId: number): Promise<MetricScore[]> {
    return Array.from(this.metricScores.values()).filter(s => s.entryId === entryId);
  }

  async getMetricScoresByUserAndDate(userId: number, date: string): Promise<MetricScore[]> {
    const entry = await this.getDailyEntry(userId, date);
    if (!entry) return [];
    return this.getMetricScoresByEntry(entry.id);
  }

  async upsertMetricScores(entryId: number, userId: number, scores: { metricKey: string; metricLabel: string; rating: string }[]): Promise<MetricScore[]> {
    // Remove existing scores for this entry
    const toDelete = Array.from(this.metricScores.values()).filter(s => s.entryId === entryId);
    toDelete.forEach(s => this.metricScores.delete(s.id));

    // Insert new scores
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

  // Subscriptions
  async getSubscription(userId: number): Promise<Subscription | undefined> {
    return this.subscriptionsMap.get(userId);
  }

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

  // User Schedule
  async getUserSchedule(userId: number): Promise<UserSchedule | undefined> {
    return this.userSchedules.get(userId);
  }

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

export const storage = new MemStorage();
