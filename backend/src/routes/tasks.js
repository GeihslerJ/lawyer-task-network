import { Router } from 'express';
import pool from '../db.js';
import { requireAuth } from '../middleware/auth.js';
import { isValidCourthouse } from '../utils/courthouse.js';

const router = Router();

router.post('/', requireAuth, async (req, res) => {
  try {
    const { courthouseLocation, description, deadline } = req.body;

    if (!courthouseLocation || !description || !deadline) {
      return res.status(400).json({ error: 'courthouseLocation, description, and deadline are required' });
    }

    if (!isValidCourthouse(courthouseLocation)) {
      return res.status(400).json({ error: 'Please select a courthouse from the predefined list' });
    }

    const result = await pool.query(
      `INSERT INTO tasks (creator_id, courthouse_location, description, deadline)
       VALUES ($1, $2, $3, $4)
       RETURNING id, creator_id, accepted_by, courthouse_location, description, deadline, status, created_at, updated_at`,
      [req.user.userId, courthouseLocation, description, deadline]
    );

    return res.status(201).json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to create task' });
  }
});

router.get('/open', requireAuth, async (req, res) => {
  try {
    const courthouse = req.query.courthouse;
    const values = [];

    let query = `SELECT t.id, t.creator_id, t.accepted_by, t.courthouse_location, t.description,
                        t.deadline, t.status, t.created_at, t.updated_at,
                        u.name AS creator_name
                 FROM tasks t
                 JOIN users u ON u.id = t.creator_id
                 WHERE t.status = 'open'`;

    if (courthouse) {
      if (!isValidCourthouse(courthouse)) {
        return res.status(400).json({ error: 'Invalid courthouse filter' });
      }
      values.push(courthouse);
      query += ` AND t.courthouse_location = $${values.length}`;
    }

    query += ' ORDER BY t.deadline ASC';

    const result = await pool.query(query, values);
    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch open tasks' });
  }
});

router.get('/mine', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT t.id, t.creator_id, t.accepted_by, t.courthouse_location, t.description,
              t.deadline, t.status, t.created_at, t.updated_at,
              creator.name AS creator_name,
              accepter.name AS accepted_lawyer_name
       FROM tasks t
       JOIN users creator ON creator.id = t.creator_id
       LEFT JOIN users accepter ON accepter.id = t.accepted_by
       WHERE t.creator_id = $1 OR t.accepted_by = $1
       ORDER BY t.created_at DESC`,
      [req.user.userId]
    );

    return res.json(result.rows);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to fetch your tasks' });
  }
});

router.post('/:taskId/accept', requireAuth, async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const taskResult = await client.query('SELECT * FROM tasks WHERE id = $1 FOR UPDATE', [req.params.taskId]);
    if (taskResult.rowCount === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({ error: 'Task not found' });
    }

    const task = taskResult.rows[0];
    if (task.status !== 'open') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Task is no longer open' });
    }

    if (task.creator_id === req.user.userId) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'You cannot accept your own task' });
    }

    const updated = await client.query(
      `UPDATE tasks
       SET status = 'accepted', accepted_by = $1, updated_at = NOW()
       WHERE id = $2
       RETURNING id, creator_id, accepted_by, courthouse_location, description, deadline, status, created_at, updated_at`,
      [req.user.userId, req.params.taskId]
    );

    await client.query('COMMIT');
    return res.json(updated.rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(error);
    return res.status(500).json({ error: 'Failed to accept task' });
  } finally {
    client.release();
  }
});

router.post('/:taskId/complete', requireAuth, async (req, res) => {
  try {
    const result = await pool.query(
      `UPDATE tasks
       SET status = 'completed', updated_at = NOW()
       WHERE id = $1 AND accepted_by = $2 AND status = 'accepted'
       RETURNING id, creator_id, accepted_by, courthouse_location, description, deadline, status, created_at, updated_at`,
      [req.params.taskId, req.user.userId]
    );

    if (result.rowCount === 0) {
      return res.status(400).json({ error: 'Only the accepting lawyer can complete an accepted task' });
    }

    return res.json(result.rows[0]);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ error: 'Failed to complete task' });
  }
});

export default router;
