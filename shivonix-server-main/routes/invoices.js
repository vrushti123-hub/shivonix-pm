const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM invoices WHERE board_id=$1 ORDER BY created_at DESC',
      [req.user.boardId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const { client_id, project_id, invoice_type, number, status, date, due_date, line_items, gst, discount, total, notes, bank_details } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO invoices (board_id, client_id, project_id, invoice_type, number, status, date, due_date, line_items, gst, discount, total, notes, bank_details)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14) RETURNING *`,
      [req.user.boardId, client_id, project_id, invoice_type, number, status, date, due_date, JSON.stringify(line_items), gst, discount, total, notes, bank_details]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  const { status, line_items, gst, discount, total, notes, bank_details, due_date } = req.body;
  try {
    const result = await pool.query(
      `UPDATE invoices SET status=$1, line_items=$2, gst=$3, discount=$4, total=$5, notes=$6, bank_details=$7, due_date=$8
       WHERE id=$9 AND board_id=$10 RETURNING *`,
      [status, JSON.stringify(line_items), gst, discount, total, notes, bank_details, due_date, req.params.id, req.user.boardId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM invoices WHERE id=$1 AND board_id=$2', [req.params.id, req.user.boardId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
