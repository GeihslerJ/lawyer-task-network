CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(120) NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash TEXT NOT NULL,
  phone_number TEXT NOT NULL,
  practice_area VARCHAR(120) NOT NULL,
  bar_id_number TEXT NOT NULL,
  state VARCHAR(60) NOT NULL,
  nearest_courthouse VARCHAR(255) NOT NULL,
  firm_code VARCHAR(30),
  role VARCHAR(20) NOT NULL DEFAULT 'lawyer' CHECK (role IN ('lawyer', 'admin')),
  verified BOOLEAN NOT NULL DEFAULT FALSE,
  bar_verification_status VARCHAR(20) NOT NULL DEFAULT 'unsubmitted' CHECK (bar_verification_status IN ('unsubmitted', 'pending', 'verified', 'rejected')),
  bar_verification_notes TEXT,
  bar_verification_requested_at TIMESTAMPTZ,
  bar_verified_at TIMESTAMPTZ,
  bar_verified_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  availability_status VARCHAR(20) NOT NULL DEFAULT 'available' CHECK (availability_status IN ('available', 'unavailable')),
  busyness_status VARCHAR(10) NOT NULL DEFAULT 'free' CHECK (busyness_status IN ('busy', 'free')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS activity_logs (
  id SERIAL PRIMARY KEY,
  actor_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  target_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  action VARCHAR(80) NOT NULL,
  metadata JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS tasks (
  id SERIAL PRIMARY KEY,
  creator_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  accepted_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  courthouse_location VARCHAR(255) NOT NULL,
  description TEXT NOT NULL,
  deadline TIMESTAMPTZ NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'accepted', 'completed')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

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

CREATE INDEX IF NOT EXISTS idx_users_nearest_courthouse ON users(nearest_courthouse);
CREATE INDEX IF NOT EXISTS idx_users_firm_code ON users(firm_code);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_tasks_status_courthouse ON tasks(status, courthouse_location);
CREATE INDEX IF NOT EXISTS idx_second_chair_status_trial_date ON second_chair_requests(status, trial_date);
CREATE INDEX IF NOT EXISTS idx_activity_logs_actor_user_id ON activity_logs(actor_user_id);
CREATE INDEX IF NOT EXISTS idx_activity_logs_target_user_id ON activity_logs(target_user_id);
