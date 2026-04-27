import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { createServer } from 'http';
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

app.use(cors());
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

httpServer.listen(port, () => {
  console.log(`Backend listening on http://localhost:${port}`);
});
