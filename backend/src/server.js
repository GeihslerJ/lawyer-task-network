import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
import pool from './db.js';
import authRoutes from './routes/auth.js';
import profileRoutes from './routes/profile.js';
import taskRoutes from './routes/tasks.js';
import secondChairRoutes from './routes/secondChair.js';
import { COURTHOUSE_OPTIONS } from './utils/courthouse.js';
import { initSocket } from './socket.js';

dotenv.config();

if (!process.env.JWT_SECRET) {
  throw new Error('JWT_SECRET is required');
}

if (!process.env.FIELD_ENCRYPTION_KEY) {
  throw new Error('FIELD_ENCRYPTION_KEY is required');
}

const app = express();
const httpServer = createServer(app);
const port = process.env.PORT || 4000;
const allowedOrigins = (process.env.CORS_ORIGIN || '')
  .split(',')
  .map((origin) => origin.trim())
  .filter(Boolean);

app.use(
  cors({
    origin: allowedOrigins.length > 0 ? allowedOrigins : true,
  })
);
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true });
});

app.get('/api/courthouses', (_req, res) => {
  res.json(COURTHOUSE_OPTIONS);
});

app.use('/api/auth', authRoutes);
app.use('/api/profile', profileRoutes);
app.use('/api/tasks', taskRoutes);
app.use('/api/second-chair', secondChairRoutes);

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: 'Unexpected server error' });
});

initSocket(httpServer);

async function ensureSchema() {
  await pool.query(
    "ALTER TABLE users ADD COLUMN IF NOT EXISTS role VARCHAR(20) NOT NULL DEFAULT 'lawyer' CHECK (role IN ('lawyer', 'admin'))"
  );
  await pool.query(
    `CREATE TABLE IF NOT EXISTS activity_logs (
      id SERIAL PRIMARY KEY,
      actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
      action VARCHAR(80) NOT NULL,
      metadata JSONB,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`
  );
}

ensureSchema()
  .then(() => {
    httpServer.listen(port, () => {
      console.log(`Backend listening on http://localhost:${port}`);
    });
  })
  .catch((error) => {
    console.error('Failed schema bootstrap', error);
    process.exit(1);
  });
