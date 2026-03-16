import Stripe from "stripe";
import { storage } from "./storage";

const STRIPE_SECRET = process.env.STRIPE_SECRET_KEY || "";
const STRIPE_WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET || "";

export const PRICE_MONTHLY = process.env.STRIPE_PRICE_MONTHLY || "";
export const PRICE_ANNUAL = process.env.STRIPE_PRICE_ANNUAL || "";
export const APP_URL = process.env.APP_URL || "http://localhost:5000";

export const stripe = STRIPE_SECRET ? new Stripe(STRIPE_SECRET) : null;

export async function createCheckoutSession(userId: number, priceId: string, email: string): Promise<string> {
  if (!stripe) throw new Error("Stripe not configured");

  // Get or create Stripe customer
  let sub = await storage.getSubscription(userId);
  let customerId = sub?.stripeCustomerId;

  if (!customerId) {
    const customer = await stripe.customers.create({ email, metadata: { userId: String(userId) } });
    customerId = customer.id;
    await storage.upsertSubscription({ userId, stripeCustomerId: customerId, plan: "free", status: "inactive" });
  }

  const session = await stripe.checkout.sessions.create({
    customer: customerId,
    payment_method_types: ["card"],
    line_items: [{ price: priceId, quantity: 1 }],
    mode: "subscription",
    success_url: `${APP_URL}/#/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${APP_URL}/#/billing/cancel`,
    metadata: { userId: String(userId) },
    allow_promotion_codes: true,
  });

  return session.url!;
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
        const plan = priceId === PRICE_ANNUAL ? "pro_annual" : "pro_monthly";

        await storage.upsertSubscription({
          userId,
          stripeCustomerId: session.customer as string,
          stripeSubscriptionId: subscription.id,
          stripePriceId: priceId,
          plan,
          status: "active",
          currentPeriodEnd: new Date(subscription.current_period_end * 1000),
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
      const plan = subscription.status === "canceled" ? "free"
        : priceId === PRICE_ANNUAL ? "pro_annual" : "pro_monthly";

      await storage.upsertSubscription({
        userId: existing.userId,
        stripeSubscriptionId: subscription.id,
        stripePriceId: priceId,
        plan,
        status: subscription.status === "active" ? "active"
          : subscription.status === "trialing" ? "trialing"
          : subscription.status === "canceled" ? "inactive" : "inactive",
        currentPeriodEnd: new Date(subscription.current_period_end * 1000),
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
