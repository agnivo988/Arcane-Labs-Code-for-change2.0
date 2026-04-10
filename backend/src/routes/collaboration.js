import express from 'express';
import crypto from 'crypto';
import CollaborationLink from '../models/CollaborationLink.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const CODE_LENGTH = 8;

const sanitizeImage = (image) => {
  if (!image || typeof image !== 'object') return null;
  const id = typeof image.id === 'string' ? image.id.slice(0, 120) : '';
  const prompt = typeof image.prompt === 'string' ? image.prompt.slice(0, 1200) : '';
  const timestamp = typeof image.timestamp === 'string' ? image.timestamp : new Date().toISOString();
  const base64 = typeof image.base64 === 'string' ? image.base64.slice(0, 3_000_000) : undefined;

  if (!id || !prompt) return null;
  return { id, prompt, timestamp, ...(base64 ? { base64 } : {}) };
};

const sanitizeSession = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return {
      currentImage: null,
      imageHistory: [],
      compareSelection: { left: null, right: null },
      lastActivity: null,
      updatedAt: new Date().toISOString()
    };
  }

  const currentImage = sanitizeImage(payload.currentImage);
  const imageHistory = Array.isArray(payload.imageHistory)
    ? payload.imageHistory.map(sanitizeImage).filter(Boolean).slice(0, 12)
    : [];

  const left = typeof payload?.compareSelection?.left === 'string' ? payload.compareSelection.left : null;
  const right = typeof payload?.compareSelection?.right === 'string' ? payload.compareSelection.right : null;
  const lastActivity = payload?.lastActivity && typeof payload.lastActivity === 'object'
    ? {
      id: typeof payload.lastActivity.id === 'string' ? payload.lastActivity.id.slice(0, 120) : '',
      text: typeof payload.lastActivity.text === 'string' ? payload.lastActivity.text.slice(0, 200) : '',
      actor: typeof payload.lastActivity.actor === 'string' ? payload.lastActivity.actor.slice(0, 120) : undefined,
      timestamp: typeof payload.lastActivity.timestamp === 'string' ? payload.lastActivity.timestamp : new Date().toISOString()
    }
    : null;

  return {
    currentImage,
    imageHistory,
    compareSelection: { left, right },
    lastActivity: lastActivity?.id && lastActivity?.text ? lastActivity : null,
    updatedAt: new Date().toISOString()
  };
};

const randomCode = () => {
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const bytes = crypto.randomBytes(CODE_LENGTH);
  let code = '';
  for (let i = 0; i < CODE_LENGTH; i += 1) {
    code += alphabet[bytes[i] % alphabet.length];
  }
  return code;
};

const createUniqueCode = async () => {
  for (let attempts = 0; attempts < 10; attempts += 1) {
    const candidate = randomCode();
    const exists = await CollaborationLink.exists({ code: candidate });
    if (!exists) return candidate;
  }
  throw new Error('Could not generate a unique collaboration code.');
};

router.post('/', requireAuth, async (req, res) => {
  try {
    const daysRaw = Number(req.body?.expiresInDays);
    const expiresInDays = Number.isFinite(daysRaw) ? Math.max(1, Math.min(30, Math.floor(daysRaw))) : 7;
    const expiresAt = new Date(Date.now() + expiresInDays * 24 * 60 * 60 * 1000);

    const code = await createUniqueCode();
    const session = sanitizeSession(req.body?.session);

    await CollaborationLink.create({
      code,
      ownerUserId: req.user.userId,
      session,
      expiresAt
    });

    res.status(201).json({ code, expiresAt: expiresAt.toISOString() });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to create collaboration link' });
  }
});

router.get('/:code', async (req, res) => {
  try {
    const code = (req.params.code || '').toUpperCase().trim();
    if (!code) {
      return res.status(400).json({ message: 'Collaboration code is required' });
    }

    const link = await CollaborationLink.findOne({ code }).select('session expiresAt createdAt');
    if (!link) {
      return res.status(404).json({ message: 'Collaboration link not found' });
    }

    if (new Date(link.expiresAt).getTime() <= Date.now()) {
      return res.status(410).json({ message: 'Collaboration link has expired' });
    }

    res.json({
      code,
      session: link.session,
      createdAt: link.createdAt,
      expiresAt: link.expiresAt
    });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to load collaboration link' });
  }
});

export default router;
