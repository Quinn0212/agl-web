// api/alipay-create.js — creates an Alipay payment via Stripe Sources
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { amount, currency } = req.body;

    // Create an Alipay source via Stripe
    const source = await stripe.sources.create({
      type: 'alipay',
      amount: amount,       // e.g. 800 = $8.00
      currency: currency || 'usd',
      redirect: {
        return_url: `${process.env.NEXT_PUBLIC_BASE_URL || 'https://aigrowthlab.vercel.app'}/payment-success`,
      },
    });

    res.status(200).json({
      qr_url:     source.alipay?.native_url || source.redirect?.url,
      payment_id: source.id,
      status:     source.status,
    });
  } catch (err) {
    console.error('Alipay error:', err);
    res.status(500).json({ error: err.message });
  }
}
