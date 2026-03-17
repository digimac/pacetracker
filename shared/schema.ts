import { pgTable, text, integer, boolean, date, serial, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod";

// Users table
export const users = pgTable("users", {
  id: serial("id").primaryKey(),
  email: text("email").notNull().unique(),
  username: text("username").notNull().unique(),
  password: text("password").notNull(),
  displayName: text("display_name").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertUserSchema = createInsertSchema(users).omit({ id: true, createdAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof users.$inferSelect;

// Custom metrics defined per user (up to 4)
export const customMetrics = pgTable("custom_metrics", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  name: text("name").notNull(),
  description: text("description"),
  emoji: text("emoji").default("⭐"),
  sortOrder: integer("sort_order").default(0),
  isActive: boolean("is_active").default(true),
});

export const insertCustomMetricSchema = createInsertSchema(customMetrics).omit({ id: true });
export type InsertCustomMetric = z.infer<typeof insertCustomMetricSchema>;
export type CustomMetric = typeof customMetrics.$inferSelect;

// Daily entries — one per user per day
export const dailyEntries = pgTable("daily_entries", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  entryDate: date("entry_date").notNull(),
  notes: text("notes"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertDailyEntrySchema = createInsertSchema(dailyEntries).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertDailyEntry = z.infer<typeof insertDailyEntrySchema>;
export type DailyEntry = typeof dailyEntries.$inferSelect;

// Metric scores — one row per metric per daily entry
// metricKey: "TIME" | "GOAL" | "TEAM" | "TASK" | "VIEW" | "PACE" | custom metric id as string "custom_1" etc.
export const metricScores = pgTable("metric_scores", {
  id: serial("id").primaryKey(),
  entryId: integer("entry_id").notNull(),
  userId: integer("user_id").notNull(),
  metricKey: text("metric_key").notNull(), // "TIME", "GOAL", "TEAM", "TASK", "VIEW", "PACE", or "custom_<id>"
  metricLabel: text("metric_label").notNull(),
  rating: text("rating").notNull(), // "success" | "setback" | "skip"
});

export const insertMetricScoreSchema = createInsertSchema(metricScores).omit({ id: true });
export type InsertMetricScore = z.infer<typeof insertMetricScoreSchema>;
export type MetricScore = typeof metricScores.$inferSelect;

// Subscription / billing
export const subscriptions = pgTable("subscriptions", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  stripePriceId: text("stripe_price_id"),
  plan: text("plan").default("free"), // "free" | "pro_monthly" | "pro_annual"
  status: text("status").default("inactive"), // "active" | "inactive" | "canceled" | "trialing"
  currentPeriodEnd: timestamp("current_period_end"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSubscriptionSchema = createInsertSchema(subscriptions).omit({ id: true, updatedAt: true });
export type InsertSubscription = z.infer<typeof insertSubscriptionSchema>;
export type Subscription = typeof subscriptions.$inferSelect;

// User schedule / profile settings
export const userSchedule = pgTable("user_schedule", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().unique(),
  wakeTime: text("wake_time").default("06:00"),
  sleepTime: text("sleep_time").default("22:00"),
  workStartTime: text("work_start_time").default("09:00"),
  workEndTime: text("work_end_time").default("17:00"),
  timezone: text("timezone").default("America/New_York"),
  dailyGoal: text("daily_goal"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertUserScheduleSchema = createInsertSchema(userSchedule).omit({ id: true, updatedAt: true });
export type InsertUserSchedule = z.infer<typeof insertUserScheduleSchema>;
export type UserSchedule = typeof userSchedule.$inferSelect;

// Metric content — admin-editable story/image/quote per core metric
export const metricContent = pgTable("metric_content", {
  id: serial("id").primaryKey(),
  metricKey: text("metric_key").notNull().unique(), // "TIME" | "GOAL" | "TEAM" | "TASK" | "VIEW" | "PACE"
  story: text("story"),
  imageUrl: text("image_url"),
  quote: text("quote"),
  quoteAuthor: text("quote_author"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMetricContentSchema = createInsertSchema(metricContent).omit({ id: true, updatedAt: true });
export type InsertMetricContent = z.infer<typeof insertMetricContentSchema>;
export type MetricContent = typeof metricContent.$inferSelect;

// Password reset tokens
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),
  token: text("token").notNull().unique(),
  expiresAt: timestamp("expires_at").notNull(),
  usedAt: timestamp("used_at"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export type PasswordResetToken = typeof passwordResetTokens.$inferSelect;
