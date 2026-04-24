// api/payment-status.js — checks the status of a PaymentIntent
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const { id } = req.query;
  if (!id) return res.status(400).json({ error: 'Missing payment id' });

  try {
    const intent = await stripe.paymentIntents.retrieve(id);
    res.status(200).json({ status: intent.status });
  } catch (err) {
    console.error('Status check error:', err);
    res.status(500).json({ error: err.message });
  }
}
