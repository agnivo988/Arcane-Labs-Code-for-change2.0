import express from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import User from '../models/User.js';
import { requireAuth } from '../middleware/auth.js';

const router = express.Router();

const createToken = (user) => jwt.sign({ userId: user._id.toString(), email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

const safeUser = (user) => {
  const json = user.toJSON();
  return {
    ...json,
    id: json._id.toString()
  };
};

router.post('/signup', async (req, res) => {
  try {
    const { name, email, password, workspaceName } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'Name, email, and password are required' });
    }

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) {
      return res.status(409).json({ message: 'Account already exists for this email' });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await User.create({
      name,
      email,
      passwordHash,
      workspaceName: workspaceName?.trim() || 'Main Studio'
    });

    const token = createToken(user);
    res.status(201).json({ token, user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Signup failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    const ok = await bcrypt.compare(password, user.passwordHash);
    if (!ok) {
      return res.status(401).json({ message: 'Invalid email or password' });
    }

    user.lastLoginAt = new Date();
    await user.save();

    const token = createToken(user);
    res.json({ token, user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Login failed' });
  }
});

router.get('/me', requireAuth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json({ user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to load profile' });
  }
});

router.patch('/me/usage', requireAuth, async (req, res) => {
  try {
    const { promptsGenerated = 0, imagesGenerated = 0, imagesEdited = 0, imagesFused = 0 } = req.body || {};
    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $inc: {
          promptsGenerated: Number(promptsGenerated) || 0,
          imagesGenerated: Number(imagesGenerated) || 0,
          imagesEdited: Number(imagesEdited) || 0,
          imagesFused: Number(imagesFused) || 0
        }
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: safeUser(user) });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to update usage' });
  }
});

router.patch('/me/usage/event', requireAuth, async (req, res) => {
  try {
    const { action } = req.body || {};

    const allowed = new Set(['generate', 'edit', 'fuse']);
    if (!allowed.has(action)) {
      return res.status(400).json({ message: 'Invalid action. Use generate, edit, or fuse.' });
    }

    const increments = {
      promptsGenerated: 1,
      imagesGenerated: 1,
      imagesEdited: action === 'edit' ? 1 : 0,
      imagesFused: action === 'fuse' ? 1 : 0
    };

    const user = await User.findByIdAndUpdate(
      req.user.userId,
      {
        $inc: increments
      },
      { new: true }
    );

    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }

    res.json({ user: safeUser(user), increments });
  } catch (error) {
    res.status(500).json({ message: error instanceof Error ? error.message : 'Failed to track usage event' });
  }
});

export default router;