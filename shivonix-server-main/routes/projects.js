const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');

router.use(auth);

// GET all projects
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM projects WHERE board_id=$1 ORDER BY created_at DESC',
      [req.user.boardId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CREATE project
router.post('/', async (req, res) => {
  const { name, client, description, phase, status, start_date, end_date, budget } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO projects (board_id, name, client, description, phase, status, start_date, end_date, budget)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.boardId, name, client, description, phase, status, start_date, end_date, budget]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE project
router.put('/:id', async (req, res) => {
  const { name, client, description, phase, status, start_date, end_date, budget } = req.body;
  try {
    const result = await pool.query(
      `UPDATE projects SET name=$1, client=$2, description=$3, phase=$4,
       status=$5, start_date=$6, end_date=$7, budget=$8
       WHERE id=$9 AND board_id=$10 RETURNING *`,
      [name, client, description, phase, status, start_date, end_date, budget, req.params.id, req.user.boardId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE project
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM projects WHERE id=$1 AND board_id=$2', [req.params.id, req.user.boardId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
