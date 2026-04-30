import dotenv from 'dotenv';
import pkg from 'pg';

dotenv.config();

const { Pool } = pkg;

if (!process.env.DATABASE_URL) {
  throw new Error('DATABASE_URL is required');
}

const shouldUseSsl =
  process.env.DB_SSL === 'true' ||
  process.env.DB_SSL === '1' ||
  Boolean(process.env.RENDER);

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: shouldUseSsl
    ? {
        rejectUnauthorized: false,
      }
    : undefined,
});

export default pool;
