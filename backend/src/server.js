import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import http from 'http';
import { Server } from 'socket.io';
import authRoutes from './routes/auth.js';
import collaborationRoutes from './routes/collaboration.js';
import billingRoutes from './routes/billing.js';
import CollaborationLink from './models/CollaborationLink.js';
import { connectDatabase } from './db.js';

dotenv.config();

const app = express();
const httpServer = http.createServer(app);
const port = Number(process.env.PORT || 4000);
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

const io = new Server(httpServer, {
  cors: {
    origin: allowedOrigin,
    methods: ['GET', 'POST']
  },
  maxHttpBufferSize: 50 * 1024 * 1024
});

const sanitizeRealtimeImage = (image) => {
  if (!image || typeof image !== 'object') return null;
  const id = typeof image.id === 'string' ? image.id.slice(0, 120) : '';
  const prompt = typeof image.prompt === 'string' ? image.prompt.slice(0, 1200) : '';
  const timestamp = typeof image.timestamp === 'string' ? image.timestamp : new Date().toISOString();
  const base64 = typeof image.base64 === 'string' ? image.base64.slice(0, 3_000_000) : undefined;
  if (!id || !prompt) return null;
  return { id, prompt, timestamp, ...(base64 ? { base64 } : {}) };
};

const sanitizeRealtimeSession = (payload) => {
  if (!payload || typeof payload !== 'object') {
    return {
      currentImage: null,
      imageHistory: [],
      compareSelection: { left: null, right: null },
      lastActivity: null,
      updatedAt: new Date().toISOString()
    };
  }

  const currentImage = sanitizeRealtimeImage(payload.currentImage);
  const imageHistory = Array.isArray(payload.imageHistory)
    ? payload.imageHistory.map(sanitizeRealtimeImage).filter(Boolean).slice(0, 16)
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

const normalizeCode = (value) => (typeof value === 'string' ? value.trim().toUpperCase() : '');

io.on('connection', (socket) => {
  socket.on('collab:join', async ({ code }) => {
    const normalized = normalizeCode(code);
    if (!normalized) {
      socket.emit('collab:error', { message: 'Missing collaboration code.' });
      return;
    }

    const link = await CollaborationLink.findOne({ code: normalized }).select('session expiresAt');
    if (!link) {
      socket.emit('collab:error', { message: 'Collaboration link not found.' });
      return;
    }

    if (new Date(link.expiresAt).getTime() <= Date.now()) {
      socket.emit('collab:error', { message: 'Collaboration link has expired.' });
      return;
    }

    const room = `collab:${normalized}`;
    socket.join(room);
    socket.data.collabCode = normalized;
    socket.emit('collab:session', { code: normalized, session: link.session });
  });

  socket.on('collab:state', async ({ code, session }) => {
    const normalized = normalizeCode(code || socket.data.collabCode);
    if (!normalized) return;
    const room = `collab:${normalized}`;
    const nextSession = sanitizeRealtimeSession(session);

    const updated = await CollaborationLink.findOneAndUpdate(
      { code: normalized, expiresAt: { $gt: new Date() } },
      { $set: { session: nextSession, updatedAt: new Date() } },
      { new: true }
    ).select('code');

    if (!updated) {
      socket.emit('collab:error', { message: 'Collaboration link is unavailable or expired.' });
      return;
    }

    socket.to(room).emit('collab:session', { code: normalized, session: nextSession });
  });
});

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '50mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'arcane-backend' });
});

app.use('/api/auth', authRoutes);
app.use('/api/collab', collaborationRoutes);
app.use('/api/billing', billingRoutes);

const start = async () => {
  await connectDatabase(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/arcane_engine');
  httpServer.listen(port, () => {
    console.log(`Arcane backend listening on http://localhost:${port}`);
  });
};

start().catch((error) => {
  console.error('Failed to start backend:', error);
  process.exit(1);
});