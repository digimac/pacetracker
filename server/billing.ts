import Stripe from "stripe";
import { storage } from "./storage";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

export const PRICE_MONTHLY       = process.env.STRIPE_PRICE_MONTHLY        || "";
export const PRICE_ANNUAL        = process.env.STRIPE_PRICE_ANNUAL         || "";
export const PRICE_GROUP_MONTHLY = process.env.STRIPE_PRICE_GROUP_MONTHLY  || "";
export const PRICE_GROUP_ANNUAL  = process.env.STRIPE_PRICE_GROUP_ANNUAL   || "";
export const APP_URL = process.env.APP_URL || "http://localhost:5000";

export const stripe = STRIPE_SECRET ? new Stripe(STRIPE_SECRET) : null;

/** Stripe Checkout only accepts a trial_end at least 48 hours out; keep a small buffer. */
const MIN_TRIAL_DEFER_MS = 49 * 60 * 60 * 1000;

/**
 * When a member still on the free month checks out, Stripe holds the first charge
 * until the free month ends. Returns that date, or null to charge today (no trial left,
 * or less than ~2 days left, which Stripe Checkout can't defer).
 */
export function firstChargeDate(trialEndsAt: Date | string | null | undefined, now = Date.now()): Date | null {
  if (!trialEndsAt) return null;
  const end = new Date(trialEndsAt);
  if (isNaN(end.getTime()) || end.getTime() - now < MIN_TRIAL_DEFER_MS) return null;
  return end;
}

/** Period end lives on the subscription item in current Stripe API versions. */
function periodEnd(sub: Stripe.Subscription): Date | null {
  const s = (sub.items?.data?.[0] as any)?.current_period_end ?? (sub as any).current_period_end ?? sub.trial_end;
  return typeof s === "number" ? new Date(s * 1000) : null;
}

function mapStatus(status: Stripe.Subscription.Status): "active" | "trialing" | "inactive" {
  return status === "active" ? "active" : status === "trialing" ? "trialing" : "inactive";
}

function planFor(priceId: string | undefined) {
  return priceId === PRICE_ANNUAL ? "pro_annual" : priceId === PRICE_GROUP_MONTHLY ? "group_monthly" : priceId === PRICE_GROUP_ANNUAL ? "group_annual" : "pro_monthly";
}

export async function createCheckoutSession(userId: number, priceId: string, email: string, trialEndsAt?: Date | string | null): Promise<{ url: string; firstChargeAt: Date | null }> {
  if (!stripe) throw new Error("Stripe not configured");

  // Get or create Stripe customer
  let sub = await storage.getSubscription(userId);
  let customerId = sub?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { userId: String(userId) } });
    customerId = customer.id;
    await storage.upsertSubscription({ userId, stripeCustomerId: customerId, plan: "free", status: "inactive" });
  }

  const firstChargeAt = firstChargeDate(trialEndsAt);
  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    // Card is collected now either way; if the free month is still running, the
    // first charge waits until it ends (Stripe shows "free until <date>" on checkout).
    payment_method_collection: "always",
    subscription_data: {
      metadata: { userId: String(userId) },
      ...(firstChargeAt ? { trial_end: Math.floor(firstChargeAt.getTime() / 1000) } : {}),
    },
    success_url: `${APP_URL}/#/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/#/billing/cancel`,
    metadata: { userId: String(userId) },
    allow_promotion_codes: true,
  });

  return { url: session.url!, firstChargeAt };
}

export async function createBillingPortalSession(userId: number): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");

  const sub = await storage.getSubscription(userId);
  if (!sub?.stripeCustomerId) throw new Error("No billing account found");

  const session = await stripe.billingPortal.sessions.create({
    customer: sub.stripeCustomerId,
    return_url: `${APP_URL}/#/settings`,
  });

  return session.url;
}

export async function handleWebhook(payload: Buffer, sig: string): Promise<void> {
  if (!stripe) throw new Error("Stripe not configured");

  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent(payload, sig, STRIPE_WEBHOOK_SECRET);
  } catch (e: any) {
    throw new Error(`Webhook signature verification failed: ${e.message}`);
  }

  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object as Stripe.Checkout.Session;
      if (session.mode === "subscription" && session.subscription) {
        const userId = parseInt(session.metadata?.userId || "0");
        if (!userId) break;

        const subscription = await stripe.subscriptions.retrieve(session.subscription as string);
        const priceId = subscription.items.data[0]?.price.id;

        await storage.upsertSubscription({
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          plan: planFor(priceId),
          // "trialing" while the free month runs out (card on file, first charge at trial end)
          status: mapStatus(subscription.status),
          currentPeriodEnd: periodEnd(subscription),
        });
      }
      break;
    }

    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object as Stripe.Subscription;
      const existing = await storage.getSubscriptionByStripeCustomerId(subscription.customer as string);
      if (!existing) break;

      const priceId = subscription.items.data[0]?.price.id;
      const plan = subscription.status === "canceled" ? "free" : planFor(priceId);

      await storage.upsertSubscription({
        userId: existing.userId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        plan,
        status: mapStatus(subscription.status),
        currentPeriodEnd: periodEnd(subscription),
      });
      break;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object as Stripe.Invoice;
      const existing = await storage.getSubscriptionByStripeCustomerId(invoice.customer as string);
      if (existing) {
        await storage.upsertSubscription({ userId: existing.userId, status: "inactive" });
      }
      break;
    }
  }
}
