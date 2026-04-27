import { Router } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import pool from '../db.js';
import { isValidCourthouse } from '../utils/courthouse.js';
import { normalizeFirmCode } from '../utils/firm.js';
import { decryptUserSensitiveFields, encryptField } from '../utils/encryption.js';

const router = Router();

router.post('/register', async (req, res) => {
  try {
    const {
      name,
      email,
      phoneNumber,
      practiceArea,
      barIdNumber,
      state,
      nearestCourthouse,
      firmCode,
      password,
    } = req.body;

    if (!name || !email || !phoneNumber || !practiceArea || !barIdNumber || !state || !nearestCourthouse || !password) {
      return res.status(400).json({ error: 'All registration fields are required' });
    }

    if (!isValidCourthouse(nearestCourthouse)) {
      return res.status(400).json({ error: 'Please select a courthouse from the predefined list' });
    }

    let normalizedFirmCode = null;
    try {
      normalizedFirmCode = normalizeFirmCode(firmCode);
    } catch (error) {
      return res.status(400).json({ error: error.message });
    }

    const existing = await pool.query('SELECT id FROM users WHERE email = $1', [email.toLowerCase()]);
    if (existing.rowCount > 0) {
      return res.status(409).json({ error: 'Email already in use' });
    }

    const passwordHash = await bcrypt.hash(password, 10);

    const result = await pool.query(
      `INSERT INTO users
       (name, email, password_hash, phone_number, practice_area, bar_id_number, state, nearest_courthouse, firm_code)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING id, name, email, phone_number, practice_area, bar_id_number, state, nearest_courthouse,
                 firm_code, verified, bar_verification_status, bar_verification_notes,
                 bar_verification_requested_at, bar_verified_at, bar_verified_by,
                 availability_status, busyness_status`,
      [
        name,
        email.toLowerCase(),
        passwordHash,
        encryptField(phoneNumber),
        practiceArea,
        encryptField(barIdNumber),
        state,
        nearestCourthouse,
        normalizedFirmCode,
      ]
    );

    const user = decryptUserSensitiveFields(result.rows[0]);
    const token = jwt.sign({ userId: user.id, email: user.email }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    return res.status(201).json({ token, user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Registration failed' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const result = await pool.query(
      `SELECT id, name, email, password_hash, phone_number, practice_area, bar_id_number, state,
              nearest_courthouse, firm_code, verified, bar_verification_status, bar_verification_notes,
              bar_verification_requested_at, bar_verified_at, bar_verified_by,
              availability_status, busyness_status
       FROM users
       WHERE email = $1`,
      [email.toLowerCase()]
    );

    if (result.rowCount === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const dbUser = decryptUserSensitiveFields(result.rows[0]);
    const isValid = await bcrypt.compare(password, dbUser.password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ userId: dbUser.id, email: dbUser.email }, process.env.JWT_SECRET, {
      expiresIn: '7d',
    });

    const { password_hash, ...user } = dbUser;
    return res.json({ token, user });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Login failed' });
  }
});

export default router;
