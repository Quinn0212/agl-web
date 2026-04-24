// api/alipay-create.js — creates an Alipay payment via Payment Intents (new API)
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, currency } = req.body;
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'https://aigrowthlab.vercel.app';

    // Create a PaymentIntent specifically for Alipay
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amount,           // in cents, e.g. 800 = $8.00
      currency: currency || 'usd',
      payment_method_types: ['alipay'],
      description: 'AI Cosplay Tutorial — AI Growth Lab',
    });

    // Confirm it with Alipay redirect — Stripe returns a URL
    const confirmed = await stripe.paymentIntents.confirm(paymentIntent.id, {
      payment_method: 'alipay',
      return_url: `${baseUrl}/alipay-return.html?pi=${paymentIntent.id}`,
    });

    // The redirect URL sends user to Alipay's payment page
    const redirectUrl = confirmed.next_action?.alipay_handle_redirect?.url
                     || confirmed.next_action?.redirect_to_url?.url
                     || null;

    res.status(200).json({
      redirect_url: redirectUrl,
      payment_id:   paymentIntent.id,
      client_secret: paymentIntent.client_secret,
    });
  } catch (err) {
    console.error('Alipay error:', err);
    res.status(500).json({ error: err.message });
  }
}
