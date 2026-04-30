import bcrypt from 'bcryptjs';
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

const baseUserSelect = `
  SELECT u.id, u.name, u.email, u.phone_number, u.practice_area, u.bar_id_number, u.state,
         u.nearest_courthouse, u.firm_code, u.firm_name, u.profile_image_url,
         u.role, u.is_active, u.verified, u.bar_verification_status, u.bar_verification_notes,
         u.bar_verification_requested_at, u.bar_verified_at, u.bar_verified_by,
         u.availability_status, u.busyness_status,
         COALESCE((SELECT AVG(ur.stars)::numeric(4,2) FROM user_ratings ur WHERE ur.rated_user_id = u.id), 0) AS reputation_avg,
         COALESCE((SELECT COUNT(*)::int FROM user_ratings ur WHERE ur.rated_user_id = u.id), 0) AS reputation_count
  FROM users u
`;

router.get('/me', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(`${baseUserSelect} WHERE u.id = $1`, [req.user.userId]);

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const user = decryptUserSensitiveFields(result.rows[0]);
    if (!user.is_active) {
      return res.status(403).json({ error: 'Account is deactivated' });
    }

    return res.json(user);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to load profile' });
  }
});

router.put('/me', requireAuth, async (req, res) => {
  try {
    const {
      phoneNumber,
      practiceArea,
      state,
      nearestCourthouse,
      firmCode,
      firmName,
      profileImageUrl,
      availabilityStatus,
      busynessStatus,
    } = req.body;

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
           firm_code = CASE WHEN $7 THEN $8 ELSE firm_code END,
           firm_name = COALESCE($9, firm_name),
           profile_image_url = COALESCE($10, profile_image_url)
       WHERE id = $11 AND is_active = TRUE
       RETURNING id`,
      [
        phoneNumber !== undefined && phoneNumber !== null ? encryptField(phoneNumber) : null,
        practiceArea ?? null,
        state ?? null,
        nearestCourthouse ?? null,
        availabilityStatus,
        busynessStatus,
        hasFirmCode,
        normalizedFirmCode,
        firmName?.trim() || null,
        profileImageUrl?.trim() || null,
        req.user.userId,
      ]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'User not found or inactive' });
    }

    const updated = await pool.query(`${baseUserSelect} WHERE u.id = $1`, [req.user.userId]);
    const updatedUser = decryptUserSensitiveFields(updated.rows[0]);

    emitAvailabilityUpdate({
      userId: updatedUser.id,
      firmCode: updatedUser.firm_code || null,
      nearestCourthouse: updatedUser.nearest_courthouse,
      availabilityStatus: updatedUser.availability_status,
      busynessStatus: updatedUser.busyness_status,
      updatedAt: new Date().toISOString(),
    });

    return res.json(updatedUser);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update profile' });
  }
});

router.delete('/me', requireAuth, async (req, res) => {
  try {
    const { password } = req.body || {};
    if (!password) {
      return res.status(400).json({ error: 'Password is required to deactivate account' });
    }

    const userResult = await pool.query('SELECT id, password_hash FROM users WHERE id = $1', [req.user.userId]);
    if (userResult.rowCount === 0) {
      return res.status(404).json({ error: 'User not found' });
    }

    const isValid = await bcrypt.compare(password, userResult.rows[0].password_hash);
    if (!isValid) {
      return res.status(401).json({ error: 'Invalid password' });
    }

    await pool.query("UPDATE users SET is_active = FALSE, availability_status = 'unavailable', busyness_status = 'busy' WHERE id = $1", [
      req.user.userId,
    ]);

    await logActivity(req.user.userId, req.user.userId, 'account_deactivated_self');
    return res.json({ message: 'Account deactivated successfully.' });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to deactivate account' });
  }
});

router.post('/admin/users/:userId/status', requireAuth, requireAdmin, async (req, res) => {
  try {
    const targetUserId = Number(req.params.userId);
    const { isActive } = req.body || {};

    if (!Number.isInteger(targetUserId) || targetUserId <= 0 || typeof isActive !== 'boolean') {
      return res.status(400).json({ error: 'Valid userId and isActive(boolean) are required' });
    }

    const result = await pool.query(
      `UPDATE users
       SET is_active = $1,
           availability_status = CASE WHEN $1 THEN availability_status ELSE 'unavailable' END,
           busyness_status = CASE WHEN $1 THEN busyness_status ELSE 'busy' END
       WHERE id = $2
       RETURNING id, name, email, is_active`,
      [isActive, targetUserId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    await logActivity(req.user.userId, targetUserId, isActive ? 'account_reactivated_admin' : 'account_deactivated_admin');
    return res.json({ message: isActive ? 'User reactivated.' : 'User deactivated.', user: result.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to update user status' });
  }
});

router.post('/ratings', requireAuth, async (req, res) => {
  try {
    const ratedUserId = Number(req.body?.ratedUserId);
    const stars = Number(req.body?.stars);
    const review = req.body?.review?.trim() || null;

    if (!Number.isInteger(ratedUserId) || ratedUserId <= 0 || !Number.isInteger(stars) || stars < 1 || stars > 5) {
      return res.status(400).json({ error: 'ratedUserId and stars(1-5) are required' });
    }

    if (ratedUserId === Number(req.user.userId)) {
      return res.status(400).json({ error: 'You cannot rate yourself' });
    }

    const targetResult = await pool.query('SELECT id, is_active FROM users WHERE id = $1', [ratedUserId]);
    if (targetResult.rowCount === 0 || !targetResult.rows[0].is_active) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    await pool.query(
      `INSERT INTO user_ratings (rater_user_id, rated_user_id, stars, review)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (rater_user_id, rated_user_id)
       DO UPDATE SET stars = EXCLUDED.stars, review = EXCLUDED.review, updated_at = NOW()`,
      [req.user.userId, ratedUserId, stars, review]
    );

    const reputation = await pool.query(
      `SELECT COALESCE(AVG(stars)::numeric(4,2), 0) AS reputation_avg,
              COALESCE(COUNT(*)::int, 0) AS reputation_count
       FROM user_ratings
       WHERE rated_user_id = $1`,
      [ratedUserId]
    );

    await logActivity(req.user.userId, ratedUserId, 'user_rated', { stars });
    return res.json({ message: 'Rating submitted.', reputation: reputation.rows[0] });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to submit rating' });
  }
});

router.get('/lawyers', requireAuth, async (req, res) => {
  try {
    const courthouse = req.query.courthouse;
    const verifiedOnly = String(req.query.verifiedOnly || '').toLowerCase() === 'true';

    const values = [req.user.userId];
    let query = `${baseUserSelect}
                 WHERE u.id != $1 AND u.is_active = TRUE`;

    if (courthouse) {
      if (!isValidCourthouse(courthouse)) {
        return res.status(400).json({ error: 'Invalid courthouse filter' });
      }
      values.push(courthouse);
      query += ` AND u.nearest_courthouse = $${values.length}`;
    }

    if (verifiedOnly) {
      query += ' AND u.verified = TRUE';
    }

    query += ' ORDER BY u.availability_status DESC, u.busyness_status ASC, u.name ASC';

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
      `${baseUserSelect}
       WHERE u.firm_code = $1 AND u.is_active = TRUE
       ORDER BY u.availability_status DESC, u.busyness_status ASC, u.name ASC`,
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

    await pool.query(
      `UPDATE users
       SET bar_verification_status = 'pending',
           bar_verification_notes = $1,
           bar_verification_requested_at = NOW()
       WHERE id = $2`,
      [notes ?? null, req.user.userId]
    );

    const updated = await pool.query(`${baseUserSelect} WHERE u.id = $1`, [req.user.userId]);
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
      `${baseUserSelect}
       WHERE u.bar_verification_status IN ('pending', 'rejected')
       ORDER BY u.bar_verification_requested_at DESC NULLS LAST, u.id DESC`
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
       RETURNING id`,
      [verified, status, notes ?? null, verifierUserId, targetUserId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'Target user not found' });
    }

    const updated = await pool.query(`${baseUserSelect} WHERE u.id = $1`, [targetUserId]);
    const updatedUser = decryptUserSensitiveFields(updated.rows[0]);
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
