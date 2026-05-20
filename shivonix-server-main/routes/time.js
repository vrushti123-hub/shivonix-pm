const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM time_entries WHERE board_id=$1 ORDER BY created_at DESC',
      [req.user.boardId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const { task_id, project_id, description, duration_minutes, date } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO time_entries (board_id, task_id, project_id, description, duration_minutes, date)
       VALUES ($1,$2,$3,$4,$5,$6) RETURNING *`,
      [req.user.boardId, task_id, project_id, description, duration_minutes, date]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM time_entries WHERE id=$1 AND board_id=$2', [req.params.id, req.user.boardId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
