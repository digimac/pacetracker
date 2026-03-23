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
  firstName: text("first_name"),
  lastName: text("last_name"),
  city: text("city"),
  region: text("region"),
  country: text("country"),
  category: text("category"),   // athlete | graduate | recovery | veteran | caregiver | entrepreneur | writer | musician
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
  ratedAt: timestamp("rated_at").defaultNow().notNull(), // when this rating was last set
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
  subtext: text("subtext"),       // Short description — shown on Settings page core metrics pane
  prompt: text("prompt"),         // Longer metrics prompt — shown inside the scoring card on Today page
  story: text("story"),
  imageUrl: text("image_url"),
  quote: text("quote"),
  quoteAuthor: text("quote_author"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertMetricContentSchema = createInsertSchema(metricContent).omit({ id: true, updatedAt: true });
export type InsertMetricContent = z.infer<typeof insertMetricContentSchema>;
export type MetricContent = typeof metricContent.$inferSelect;

// Site pages — admin-managed CMS content for Story, Daily Tracking, Connect pages
export const sitePages = pgTable("site_pages", {
  id: serial("id").primaryKey(),
  pageKey: text("page_key").notNull().unique(), // "story" | "tracking" | "connect"
  title: text("title").notNull(),
  subtitle: text("subtitle"),
  heroImageUrl: text("hero_image_url"),
  body: text("body"), // rich text / markdown body
  // Flexible extra content slots (JSON-serialized array of {heading, text, imageUrl})
  sections: text("sections"), // JSON string: [{heading, text, imageUrl}]
  // Connect page specifics
  contactEmail: text("contact_email"),
  socialLinks: text("social_links"), // JSON string: [{platform, url}]
  ctaLabel: text("cta_label"),
  ctaUrl: text("cta_url"),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertSitePageSchema = createInsertSchema(sitePages).omit({ id: true, updatedAt: true });
export type InsertSitePage = z.infer<typeof insertSitePageSchema>;
export type SitePage = typeof sitePages.$inferSelect;

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

// Invite tokens — sent via email/SMS, used once to register + auto-connect
export const invites = pgTable("invites", {
  id: serial("id").primaryKey(),
  senderId: integer("sender_id").notNull(),         // user who sent the invite
  inviteeEmail: text("invitee_email"),               // email address invited (nullable if SMS)
  inviteePhone: text("invitee_phone"),               // phone number invited (nullable if email)
  token: text("token").notNull().unique(),           // UUID token in the invite link
  message: text("message"),                          // optional personal message
  status: text("status").default("pending").notNull(), // "pending" | "accepted" | "declined" | "expired"
  acceptedByUserId: integer("accepted_by_user_id"), // set when accepted
  expiresAt: timestamp("expires_at").notNull(),
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertInviteSchema = createInsertSchema(invites).omit({ id: true, createdAt: true });
export type InsertInvite = z.infer<typeof insertInviteSchema>;
export type Invite = typeof invites.$inferSelect;

// Connections — mutual accountability partnerships between two users
export const connections = pgTable("connections", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull(),             // the member who sent the invite
  partnerId: integer("partner_id").notNull(),       // the member who accepted
  inviteId: integer("invite_id"),                   // reference back to invite
  createdAt: timestamp("created_at").defaultNow().notNull(),
});

export const insertConnectionSchema = createInsertSchema(connections).omit({ id: true, createdAt: true });
export type InsertConnection = z.infer<typeof insertConnectionSchema>;
export type Connection = typeof connections.$inferSelect;

// Email Templates — admin-configurable email content
export const emailTemplates = pgTable("email_templates", {
  id:        serial("id").primaryKey(),
  key:       text("key").notNull().unique(),   // e.g. "invite", "password_reset"
  subject:   text("subject").notNull(),
  bodyHtml:  text("body_html").notNull(),
  bodyText:  text("body_text").notNull(),
  updatedAt: timestamp("updated_at").defaultNow().notNull(),
});

export const insertEmailTemplateSchema = createInsertSchema(emailTemplates).omit({ id: true, updatedAt: true });
export type InsertEmailTemplate = z.infer<typeof insertEmailTemplateSchema>;
export type EmailTemplate = typeof emailTemplates.$inferSelect;
