import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import authRoutes from './routes/auth.js';
import { connectDatabase } from './db.js';

dotenv.config();

const app = express();
const port = Number(process.env.PORT || 4000);
const allowedOrigin = process.env.FRONTEND_ORIGIN || 'http://localhost:3000';

app.use(cors({ origin: allowedOrigin }));
app.use(express.json({ limit: '2mb' }));

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'arcane-backend' });
});

app.use('/api/auth', authRoutes);

const start = async () => {
  await connectDatabase(process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/arcane_engine');
  app.listen(port, () => {
    console.log(`Arcane backend listening on http://localhost:${port}`);
  });
};

start().catch((error) => {
  console.error('Failed to start backend:', error);
  process.exit(1);
});