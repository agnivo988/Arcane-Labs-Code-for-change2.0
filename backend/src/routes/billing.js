import express from 'express';
import Stripe from 'stripe';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const getStripeClient = () => {
  const secretKey = process.env.STRIPE_SECRET_KEY;
  if (!secretKey) {
    throw new Error('Missing STRIPE_SECRET_KEY');
  }
  return new Stripe(secretKey, { apiVersion: '2024-06-20' });
};

const getBaseUrl = (req) => {
  if (process.env.FRONTEND_ORIGIN) return process.env.FRONTEND_ORIGIN;
  if (req.headers.origin) return req.headers.origin;
  return 'http://localhost:3000';
};

router.post('/create-checkout-session', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select('email plan');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    if ((user.plan || '').toLowerCase() === 'pro') {
      return res.status(409).json({ message: 'You are already on the Pro plan.' });
    }

    const priceId = process.env.STRIPE_PRICE_ID;

    const stripe = getStripeClient();
    const baseUrl = getBaseUrl(req);
    const lineItems = priceId
      ? [{ price: priceId, quantity: 1 }]
      : [
          {
            price_data: {
              currency: 'usd',
              unit_amount: 2000,
              product_data: {
                name: 'ARcane Engine Pro Upgrade'
              }
            },
            quantity: 1
          }
        ];

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      payment_method_types: ['card'],
      line_items: lineItems,
      success_url: `${baseUrl}/studio?billing=success&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/studio?billing=cancel`,
      client_reference_id: String(user._id),
      customer_email: user.email,
      metadata: {
        userId: String(user._id),
        plan: 'pro'
      }
    });

    return res.json({ checkoutUrl: session.url });
  } catch (error) {
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to create checkout session.'
    });
  }
});

router.post('/confirm-checkout-session', requireAuth, async (req, res) => {
  try {
    const { sessionId } = req.body || {};
    if (!sessionId || typeof sessionId !== 'string') {
      return res.status(400).json({ message: 'sessionId is required.' });
    }

    const stripe = getStripeClient();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    const isOwnedByUser =
      session?.metadata?.userId === req.user.userId ||
      session?.client_reference_id === req.user.userId;

    if (!isOwnedByUser) {
      return res.status(403).json({ message: 'This checkout session does not belong to the current user.' });
    }

    if (session.payment_status !== 'paid') {
      return res.status(409).json({ message: 'Payment is not completed yet.' });
    }

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      { $set: { plan: 'pro', status: 'active' } },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    return res.json({ ok: true, user });
  } catch (error) {
    return res.status(500).json({
      message: error instanceof Error ? error.message : 'Failed to confirm checkout session.'
    });
  }
});

export default router;
