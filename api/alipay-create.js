// api/alipay-create.js — creates a PaymentIntent for Alipay
// Frontend uses Stripe.js to confirm and redirect
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    // Alipay in Malaysia only supports MYR and CNY
    const paymentIntent = await stripe.paymentIntents.create({
      amount: 3500,              // RM 35.00 in sen (≈ $8 USD)
      currency: 'myr',
      payment_method_types: ['alipay'],
      description: 'AI Cosplay Tutorial — AI Growth Lab',
    });

    res.status(200).json({
      client_secret: paymentIntent.client_secret,
      payment_id:    paymentIntent.id,
    });
  } catch (err) {
    console.error('Alipay error:', err);
    res.status(500).json({ error: err.message });
  }
}
