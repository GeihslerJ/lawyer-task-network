import { Router } from 'express';
import pool from '../db.js';
import { requireAdmin, requireAuth } from '../middleware/auth.js';
import { isValidCourthouse } from '../utils/courthouse.js';
import { normalizeFirmCode } from '../utils/firm.js';
import { decryptField, decryptUserSensitiveFields, encryptField } from '../utils/encryption.js';
import { emitAvailabilityUpdate } from '../socket.js';

const router = Router();

async function logActivity(actorUserId, targetUserId, action, metadata = null) {
  try {
    await pool.query(
      `INSERT INTO activity_logs (actor_user_id, target_user_id, action, metadata)
       VALUES ($1, $2, $3, $4)`,
      [actorUserId ?? null, targetUserId ?? null, action, metadata]
    );
  } catch (error) {
    console.error('Activity log write failed:', error.message);
  }
}

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone_number, practice_area, bar_id_number, state,
              nearest_courthouse, firm_code, role, verified, bar_verification_status, bar_verification_notes,
              bar_verification_requested_at, bar_verified_at, bar_verified_by,
              availability_status, busyness_status
       FROM users WHERE id = $1`,
      [req.user.userId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    return res.json(decryptUserSensitiveFields(result.rows[0]));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.put('/me', requireAuth, async (req, res) => {
  try {
    const { phoneNumber, practiceArea, state, nearestCourthouse, firmCode, availabilityStatus, busynessStatus } = req.body;

    if (!availabilityStatus || !['available', 'unavailable'].includes(availabilityStatus)) {
      return res.status(400).json({ error: 'availabilityStatus must be available or unavailable' });
    }

    if (!busynessStatus || !['busy', 'free'].includes(busynessStatus)) {
      return res.status(400).json({ error: 'busynessStatus must be busy or free' });
    }

    if (nearestCourthouse && !isValidCourthouse(nearestCourthouse)) {
      return res.status(400).json({ error: 'Please select a courthouse from the predefined list' });
    }

    const hasFirmCode = Object.prototype.hasOwnProperty.call(req.body, 'firmCode');
    let normalizedFirmCode = null;

    if (hasFirmCode) {
      try {
        normalizedFirmCode = normalizeFirmCode(firmCode);
      } catch (error) {
        return res.status(400).json({ error: error.message });
      }
    }

    const result = await pool.query(
      `UPDATE users
       SET phone_number = COALESCE($1, phone_number),
           practice_area = COALESCE($2, practice_area),
           state = COALESCE($3, state),
           nearest_courthouse = COALESCE($4, nearest_courthouse),
           availability_status = $5,
           busyness_status = $6,
           firm_code = CASE WHEN $7 THEN $8 ELSE firm_code END
       WHERE id = $9
       RETURNING id, name, email, phone_number, practice_area, bar_id_number, state,
                 nearest_courthouse, firm_code, role, verified, bar_verification_status, bar_verification_notes,
                 bar_verification_requested_at, bar_verified_at, bar_verified_by,
                 availability_status, busyness_status`,
      [
        phoneNumber !== undefined && phoneNumber !== null ? encryptField(phoneNumber) : null,
        practiceArea ?? null,
        state ?? null,
        nearestCourthouse ?? null,
        availabilityStatus,
        busynessStatus,
        hasFirmCode,
        normalizedFirmCode,
        req.user.userId,
      ]
    );

    const updatedUser = result.rows[0] ? decryptUserSensitiveFields(result.rows[0]) : null;

    if (updatedUser) {
      emitAvailabilityUpdate({
        userId: updatedUser.id,
        firmCode: updatedUser.firm_code || null,
        nearestCourthouse: updatedUser.nearest_courthouse,
        availabilityStatus: updatedUser.availability_status,
        busynessStatus: updatedUser.busyness_status,
        updatedAt: new Date().toISOString(),
      });
    }

    return res.json(updatedUser);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.get('/lawyers', requireAuth, async (req, res) => {
  try {
    const courthouse = req.query.courthouse;

    const values = [req.user.userId];
    let query = `SELECT id, name, email, phone_number, practice_area, state,
                        nearest_courthouse, firm_code, role, verified, bar_verification_status, bar_verification_notes,
                        bar_verification_requested_at, bar_verified_at, bar_verified_by,
                        availability_status, busyness_status
                 FROM users
                 WHERE id != $1`;

    if (courthouse) {
      if (!isValidCourthouse(courthouse)) {
        return res.status(400).json({ error: 'Invalid courthouse filter' });
      }
      values.push(courthouse);
      query += ` AND nearest_courthouse = $${values.length}`;
    }

    query += ' ORDER BY availability_status DESC, busyness_status ASC, name ASC';

    const result = await pool.query(query, values);
    return res.json(result.rows.map((row) => decryptUserSensitiveFields(row)));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch lawyers' });
  }
});

router.get('/firm-members', requireAuth, async (req, res) => {
  try {
    const meResult = await pool.query('SELECT id, firm_code FROM users WHERE id = $1', [req.user.userId]);
    if (meResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const firmCode = meResult.rows[0].firm_code;
    if (!firmCode) {
      return res.status(400).json({ error: 'Set your firm code to use firm mode' });
    }

    const membersResult = await pool.query(
      `SELECT id, name, email, phone_number, practice_area, state, nearest_courthouse,
              firm_code, role, verified, bar_verification_status, bar_verification_notes,
              bar_verification_requested_at, bar_verified_at, bar_verified_by,
              availability_status, busyness_status
       FROM users
       WHERE firm_code = $1
       ORDER BY availability_status DESC, busyness_status ASC, name ASC`,
      [firmCode]
    );

    const members = membersResult.rows.map((row) => decryptUserSensitiveFields(row));
    const summary = {
      total: members.length,
      available: members.filter((m) => m.availability_status === 'available').length,
      unavailable: members.filter((m) => m.availability_status === 'unavailable').length,
      free: members.filter((m) => m.busyness_status === 'free').length,
      busy: members.filter((m) => m.busyness_status === 'busy').length,
    };

    return res.json({ firmCode, summary, members });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to load firm members' });
  }
});

router.post('/me/bar-verification-request', requireAuth, async (req, res) => {
  try {
    const { notes } = req.body || {};

    const userResult = await pool.query(
      `SELECT id, bar_id_number, bar_verification_status
       FROM users
       WHERE id = $1`,
      [req.user.userId]
    );

    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = userResult.rows[0];
    const plainBarId = decryptField(user.bar_id_number);
    const looksValidFormat = /^[A-Z0-9-]{4,30}$/i.test((plainBarId || '').trim());

    if (!looksValidFormat) {
      return res.status(400).json({ error: 'Bar ID format does not pass placeholder validation' });
    }

    const updated = await pool.query(
      `UPDATE users
       SET bar_verification_status = 'pending',
           bar_verification_notes = $1,
           bar_verification_requested_at = NOW()
       WHERE id = $2
       RETURNING id, name, email, phone_number, practice_area, bar_id_number, state,
                 nearest_courthouse, firm_code, role, verified, bar_verification_status, bar_verification_notes,
                 bar_verification_requested_at, bar_verified_at, bar_verified_by,
                 availability_status, busyness_status`,
      [notes ?? null, req.user.userId]
    );

    const updatedUser = decryptUserSensitiveFields(updated.rows[0]);
    await logActivity(req.user.userId, req.user.userId, 'bar_verification_requested', {
      status: updatedUser.bar_verification_status,
    });

    return res.json({
      message: 'Verification request submitted (placeholder workflow).',
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to submit bar verification request' });
  }
});

router.get('/bar-verification/queue', requireAuth, requireAdmin, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT id, name, email, phone_number, practice_area, state, nearest_courthouse, firm_code,
              role, verified, bar_verification_status, bar_verification_notes, bar_verification_requested_at
       FROM users
       WHERE bar_verification_status IN ('pending', 'rejected')
       ORDER BY bar_verification_requested_at DESC NULLS LAST, id DESC`
    );
    return res.json(result.rows.map((row) => decryptUserSensitiveFields(row)));
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to load verification queue' });
  }
});

router.get('/activity-logs', requireAuth, requireAdmin, async (req, res) => {
  try {
    const limit = Math.min(Number(req.query.limit) || 50, 200);
    const result = await pool.query(
      `SELECT l.id, l.actor_user_id, l.target_user_id, l.action, l.metadata, l.created_at,
              actor.name AS actor_name, target.name AS target_name
       FROM activity_logs l
       LEFT JOIN users actor ON actor.id = l.actor_user_id
       LEFT JOIN users target ON target.id = l.target_user_id
       ORDER BY l.created_at DESC
       LIMIT $1`,
      [limit]
    );
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to load activity logs' });
  }
});

router.post('/bar-verification/manual', requireAuth, requireAdmin, async (req, res) => {
  try {
    const { userId, verified, notes } = req.body || {};
    const targetUserId = Number(userId);
    const verifierUserId = Number(req.user.userId);

    if (!Number.isInteger(targetUserId) || targetUserId <= 0 || typeof verified !== 'boolean') {
      return res.status(400).json({ error: 'userId and verified(boolean) are required' });
    }
    if (!Number.isInteger(verifierUserId) || verifierUserId <= 0) {
      return res.status(400).json({ error: 'Invalid verifier user id in token' });
    }

    const status = verified ? 'verified' : 'rejected';

    const result = await pool.query(
      `UPDATE users
       SET verified = $1,
           bar_verification_status = $2,
           bar_verification_notes = $3,
           bar_verified_at = CASE WHEN $1 THEN NOW() ELSE NULL END,
           bar_verified_by = CASE WHEN $1 THEN $4::INTEGER ELSE NULL END
       WHERE id = $5::INTEGER
       RETURNING id, name, email, phone_number, practice_area, bar_id_number, state,
                 nearest_courthouse, firm_code, role, verified, bar_verification_status, bar_verification_notes,
                 bar_verification_requested_at, bar_verified_at, bar_verified_by,
                 availability_status, busyness_status`,
      [verified, status, notes ?? null, verifierUserId, targetUserId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    const updatedUser = decryptUserSensitiveFields(result.rows[0]);
    await logActivity(req.user.userId, updatedUser.id, verified ? 'bar_verified_manual' : 'bar_rejected_manual', {
      notes: notes ?? null,
    });

    return res.json({
      message: 'Manual verification updated (placeholder workflow).',
      user: updatedUser,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update manual verification' });
  }
});

export default router;
