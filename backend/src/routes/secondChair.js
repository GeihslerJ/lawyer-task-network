import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { taskActionRateLimit } from '../middleware/rateLimit.js';

const router = Router();

router.post('/', requireAuth, taskActionRateLimit, async (req, res) => {
  try {
    const { caseType, date, experienceLevelNeeded } = req.body;

    if (!caseType || !date || !experienceLevelNeeded) {
      return res.status(400).json({ error: 'caseType, date, and experienceLevelNeeded are required' });
    }

    const result = await pool.query(
      `INSERT INTO second_chair_requests (creator_id, case_type, trial_date, experience_level_needed)
       VALUES ($1, $2, $3, $4)
       RETURNING id, creator_id, accepted_by, case_type, trial_date, experience_level_needed, status, created_at, updated_at`,
      [req.user.userId, caseType, date, experienceLevelNeeded]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to create second-chair request' });
  }
});

router.get('/open', requireAuth, async (_req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.creator_id, r.accepted_by, r.case_type, r.trial_date,
              r.experience_level_needed, r.status, r.created_at, r.updated_at,
              creator.name AS creator_name
       FROM second_chair_requests r
       JOIN users creator ON creator.id = r.creator_id
       WHERE r.status = 'open'
       ORDER BY r.trial_date ASC`
    );

    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch open second-chair requests' });
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.id, r.creator_id, r.accepted_by, r.case_type, r.trial_date,
              r.experience_level_needed, r.status, r.created_at, r.updated_at,
              creator.name AS creator_name,
              accepter.name AS accepted_lawyer_name
       FROM second_chair_requests r
       JOIN users creator ON creator.id = r.creator_id
       LEFT JOIN users accepter ON accepter.id = r.accepted_by
       WHERE r.creator_id = $1 OR r.accepted_by = $1
       ORDER BY r.created_at DESC`,
      [req.user.userId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch your second-chair requests' });
  }
});

router.post('/:requestId/accept', requireAuth, taskActionRateLimit, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const requestResult = await client.query('SELECT * FROM second_chair_requests WHERE id = $1 FOR UPDATE', [
      req.params.requestId,
    ]);

    if (requestResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Second-chair request not found' });
    }

    const secondChairRequest = requestResult.rows[0];
    if (secondChairRequest.status !== 'open') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Second-chair request is no longer open' });
    }

    if (secondChairRequest.creator_id === req.user.userId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You cannot accept your own second-chair request' });
    }

    const updated = await client.query(
      `UPDATE second_chair_requests
       SET status = 'accepted', accepted_by = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, creator_id, accepted_by, case_type, trial_date, experience_level_needed, status, created_at, updated_at`,
      [req.user.userId, req.params.requestId]
    );

    await client.query('COMMIT');
    return res.json(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ error: 'Failed to accept second-chair request' });
  } finally {
    client.release();
  }
});

export default router;
