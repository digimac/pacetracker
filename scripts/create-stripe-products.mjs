// Run with: STRIPE_SECRET_KEY=sk_... node scripts/create-stripe-products.mjs
import Stripe from "stripe";

const key = process.env.STRIPE_SECRET_KEY;
if (!key) { console.error("STRIPE_SECRET_KEY not set"); process.exit(1); }

const stripe = new Stripe(key);

// Create the Sweet Momentum Pro product
const product = await stripe.products.create({
  name: "Sweet Momentum Pro",
  description: "Unlock custom metrics, full history, and all premium features.",
  metadata: { app: "sweet-momentum" },
});
console.log("Product created:", product.id);

// Monthly price — $9.99/mo
const monthly = await stripe.prices.create({
  product: product.id,
  unit_amount: 999,
  currency: "usd",
  recurring: { interval: "month" },
  nickname: "Pro Monthly",
  metadata: { plan: "pro_monthly" },
});
console.log("Monthly price:", monthly.id);

// Annual price — $99/yr
const annual = await stripe.prices.create({
  product: product.id,
  unit_amount: 9900,
  currency: "usd",
  recurring: { interval: "year" },
  nickname: "Pro Annual",
  metadata: { plan: "pro_annual" },
});
console.log("Annual price:", annual.id);

console.log("\n--- Copy these into your .env ---");
console.log(`STRIPE_PRICE_MONTHLY=${monthly.id}`);
console.log(`STRIPE_PRICE_ANNUAL=${annual.id}`);
console.log(`STRIPE_PRODUCT_ID=${product.id}`);
