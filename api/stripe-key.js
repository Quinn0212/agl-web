// api/stripe-key.js — returns Stripe publishable key to frontend
export default function handler(req, res) {
  res.status(200).json({
    publishableKey: process.env.STRIPE_PUBLIC_KEY
  });
}
