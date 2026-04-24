// api/payment-status.js — polls the status of an Alipay / Stripe source
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing payment id' });

  try {
    // For Alipay Source
    if (id.startsWith('src_')) {
      const source = await stripe.sources.retrieve(id);

      // If source is chargeable, charge it
      if (source.status === 'chargeable') {
        const charge = await stripe.charges.create({
          amount:   source.amount,
          currency: source.currency,
          source:   id,
        });
        return res.status(200).json({
          status: charge.status === 'succeeded' ? 'succeeded' : 'pending',
        });
      }

      return res.status(200).json({ status: source.status }); // pending / failed / canceled
    }

    // For Stripe PaymentIntent
    if (id.startsWith('pi_')) {
      const intent = await stripe.paymentIntents.retrieve(id);
      return res.status(200).json({ status: intent.status });
    }

    return res.status(200).json({ status: 'unknown' });
  } catch (err) {
    console.error('Status check error:', err);
    res.status(500).json({ error: err.message });
  }
}
