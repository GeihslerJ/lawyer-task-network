# Lawyer Task Network

Minimal full-stack web app for connecting lawyers for filing/task assistance.

## Stack

- Frontend: React + Vite
- Backend: Node.js + Express
- Database: PostgreSQL
- Auth: Email/password with JWT

## Project Structure

- `backend/` Express API + PostgreSQL schema
- `frontend/` React app

## Setup

### 1) Database

Create a PostgreSQL database named `lawyer_network` (or use your own name), then run:

```bash
psql "$DATABASE_URL" -f backend/sql/schema.sql
```

If you already created the DB before firm mode was added, run this migration:

```sql
ALTER TABLE users ADD COLUMN IF NOT EXISTS firm_code VARCHAR(30);
CREATE INDEX IF NOT EXISTS idx_users_firm_code ON users(firm_code);
ALTER TABLE users ALTER COLUMN phone_number TYPE TEXT;
ALTER TABLE users ALTER COLUMN bar_id_number TYPE TEXT;
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS bar_verification_status VARCHAR(20) NOT NULL DEFAULT 'unsubmitted',
  ADD COLUMN IF NOT EXISTS bar_verification_notes TEXT,
  ADD COLUMN IF NOT EXISTS bar_verification_requested_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bar_verified_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS bar_verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS second_chair_requests (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  case_type VARCHAR(120) NOT NULL,
  trial_date TIMESTAMPTZ NOT NULL,
  experience_level_needed VARCHAR(40) NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_second_chair_status_trial_date ON second_chair_requests(status, trial_date);
```

After deploying encryption code, existing plaintext `phone_number` and `bar_id_number` values should be re-saved (for example via profile updates or a one-time migration script) so they are encrypted at rest.

### 2) Backend

```bash
cd backend
cp .env.example .env
npm install
npm run dev
```

Backend runs on `http://localhost:4000`.

`FIELD_ENCRYPTION_KEY` is required for encrypting sensitive fields at rest (`phone_number`, `bar_id_number`).
Use either:
- 32-byte base64 string
- 64-character hex string

Set `CORS_ORIGIN` to your frontend origin (for local: `http://localhost:5173`).

### 3) Frontend

```bash
cd frontend
cp .env.example .env
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`.

## Core API Endpoints

- `GET /api/courthouses` (predefined courthouse list)
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET /api/profile/me`
- `PUT /api/profile/me`
- `GET /api/profile/firm-members`
- `GET /api/profile/lawyers?courthouse=...`
- `POST /api/profile/me/bar-verification-request`
- `POST /api/profile/bar-verification/manual`
- `POST /api/tasks`
- `GET /api/tasks/open?courthouse=...`
- `GET /api/tasks/mine`
- `POST /api/tasks/:taskId/accept`
- `POST /api/tasks/:taskId/complete`
- `POST /api/second-chair`
- `GET /api/second-chair/open`
- `GET /api/second-chair/mine`
- `POST /api/second-chair/:requestId/accept`

## Courthouse Selection System

- Users choose `nearestCourthouse` from the predefined list returned by `GET /api/courthouses`.
- Registration and profile updates validate courthouse values server-side.
- Task creation validates `courthouseLocation` against the same list.
- Marketplace filtering for lawyers and open tasks uses courthouse equality filtering.

## Firm Mode

- Users can set an optional `firmCode` in registration/profile.
- Users sharing the same code can view each other in Firm Mode.
- Internal availability tracking is provided via `GET /api/profile/firm-members`, including:
  - member list
  - total/available/unavailable/free/busy summary

## Second Chair Requests

- Lawyers can post trial assistance requests with:
  - `caseType`
  - `date`
  - `experienceLevelNeeded`
- Other lawyers can accept open requests.

## Data Encryption

- Sensitive user fields are encrypted at rest:
  - `phone_number`
  - `bar_id_number`
- Encryption uses AES-256-GCM with per-value random IVs.
- API responses decrypt these fields transparently before returning to the frontend.

## Bar ID Verification (Placeholder)

- Users can submit a bar verification request via `POST /api/profile/me/bar-verification-request`.
- Manual verification is handled via `POST /api/profile/bar-verification/manual`.
  - Payload: `userId`, `verified` (boolean), optional `notes`
- Users are marked verified manually for now through this placeholder workflow.

## Live Availability (WebSocket)

- WebSocket server runs with the backend on `http://localhost:4000` using Socket.IO.
- Event emitted when profile availability changes:
  - `availability:update`
  - Payload:
    - `userId`
    - `firmCode`
    - `nearestCourthouse`
    - `availabilityStatus`
    - `busynessStatus`
    - `updatedAt`
- Frontend pages wired for live updates:
  - Task marketplace lawyer list
  - Firm mode member list and summary

## Deploy (Render + Vercel)

### Backend on Render

1. Create a new Web Service from your repo.
2. Root directory: `backend`
3. Build command: `npm install`
4. Start command: `npm start`
5. Set environment variables:
   - `DATABASE_URL` (from your hosted Postgres)
   - `JWT_SECRET`
   - `FIELD_ENCRYPTION_KEY`
   - `CORS_ORIGIN` (your frontend URL, e.g. `https://your-app.vercel.app`)
6. Deploy and verify health endpoint:
   - `https://your-backend.onrender.com/api/health`

### Frontend on Vercel

1. Create project from your repo.
2. Root directory: `frontend`
3. Build command: `npm run build`
4. Output directory: `dist`
5. Add environment variable:
   - `VITE_API_BASE_URL=https://your-backend.onrender.com/api`
6. Deploy and open the Vercel URL.

### Production Database

Run schema against your production Postgres:

```bash
psql "$DATABASE_URL" -f backend/sql/schema.sql
```
