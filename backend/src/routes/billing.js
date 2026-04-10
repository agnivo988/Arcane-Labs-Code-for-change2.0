import express from 'express';
import Stripe from 'stripe';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const FREE_IMAGE_LIMIT = 10;
const frontendOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

const getStripe = () => {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) {
    throw new Error('STRIPE_SECRET_KEY is not configured.');
  }
  return new Stripe(key);
};

const getCheckoutPayload = (user) => {
  const priceId = process.env.STRIPE_PRO_PRICE_ID;

  return {
    mode: 'subscription',
    success_url: `${frontendOrigin}/studio?billing=success&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${frontendOrigin}/studio?billing=cancel`,
    metadata: {
      userId: user._id.toString(),
      tier: 'pro'
    },
    ...(user.stripeCustomerId ? { customer: user.stripeCustomerId } : { customer_email: user.email }),
    ...(priceId
      ? {
        line_items: [{ price: priceId, quantity: 1 }]
      }
      : {
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: 'ARcane Engine Pro'
              },
              recurring: { interval: 'month' },
              unit_amount: 2000
            },
            quantity: 1
          }
        ]
      })
  };
};

const activateProForUser = async ({ userId, customerId, subscriptionId }) => {
  if (!userId) return null;

  return User.findByIdAndUpdate(userId, {
    $set: {
      plan: 'pro',
      status: 'active',
      stripeCustomerId: customerId || null,
      stripeSubscriptionId: subscriptionId || null,
      proActivatedAt: new Date()
    }
  }, { new: true });
};

router.post('/create-checkout-session', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found.' });
    }

    if (user.plan === 'pro') {
      return res.status(409).json({ message: 'You are already on Pro.' });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.create(getCheckoutPayload(user));

    return res.json({
      checkoutUrl: session.url,
      sessionId: session.id,
      freeLimit: FREE_IMAGE_LIMIT
    });
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to create checkout session.' });
  }
});

router.post('/confirm-checkout-session', requireAuth, async (req, res) => {
  try {
    const sessionId = String(req.body?.sessionId || '').trim();
    if (!sessionId) {
      return res.status(400).json({ message: 'Missing sessionId.' });
    }

    const stripe = getStripe();
    const session = await stripe.checkout.sessions.retrieve(sessionId);

    if (!session || session.mode !== 'subscription') {
      return res.status(400).json({ message: 'Invalid checkout session.' });
    }

    const metadataUserId = session.metadata?.userId || null;
    const currentUserId = req.user.userId;
    if (metadataUserId && metadataUserId !== currentUserId) {
      return res.status(403).json({ message: 'This checkout session belongs to another user.' });
    }

    const paid = session.payment_status === 'paid' || session.status === 'complete';
    if (!paid) {
      return res.status(409).json({ message: 'Payment is not completed yet.' });
    }

    const customerId = typeof session.customer === 'string' ? session.customer : null;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;

    const updated = await activateProForUser({
      userId: currentUserId,
      customerId,
      subscriptionId
    });

    if (!updated) {
      return res.status(404).json({ message: 'User not found.' });
    }

    return res.json({ ok: true, plan: updated.plan, status: updated.status });
  } catch (error) {
    return res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to confirm checkout session.' });
  }
});

export const handleStripeWebhook = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (!sig || typeof sig !== 'string') {
    return res.status(400).send('Missing Stripe signature');
  }

  if (!process.env.STRIPE_WEBHOOK_SECRET) {
    return res.status(500).send('STRIPE_WEBHOOK_SECRET is not configured');
  }

  try {
    const stripe = getStripe();
    const event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);

    if (event.type === 'checkout.session.completed') {
      const session = event.data.object;
      const userId = session?.metadata?.userId;
      const customerId = typeof session.customer === 'string' ? session.customer : null;
      const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;

      if (userId) {
        await activateProForUser({ userId, customerId, subscriptionId });
      }
    }

    return res.json({ received: true });
  } catch (error) {
    return res.status(400).send(`Webhook Error: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
};

export default router;
