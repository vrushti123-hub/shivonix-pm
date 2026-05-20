const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
router.use(auth);

// GET all clients
router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM clients WHERE board_id=$1 ORDER BY created_at DESC',
      [req.user.boardId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// CREATE client
router.post('/', async (req, res) => {
  const { name, company, email, phone, address, budget, deadline, status, project_id, reference, notes, send_welcome } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO clients (board_id, project_id, name, company, email, phone, address, budget, deadline, status, reference, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) RETURNING *`,
      [req.user.boardId, project_id, name, company, email, phone, address, budget, deadline, status, reference, notes]
    );

    // Send welcome email if checkbox checked
    if (send_welcome && email) {
      await resend.emails.send({
        from: 'Shivonix <noreply@shivonix.com>',
        to: email,
        subject: 'Thanks for reaching out to Shivonix!',
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f9f9;border-radius:12px;">
            <h2 style="color:#6c63ff;">👋 Thank you, ${name}!</h2>
            <p>Thank you for reaching out to <b>Shivonix</b>. We have received your inquiry and our team will get back to you shortly.</p>
            <p>We look forward to working with you!</p>
            <p style="color:#888;font-size:12px;margin-top:24px;">Shivonix — Project Management</p>
          </div>
        `
      });
    }

    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// UPDATE client
router.put('/:id', async (req, res) => {
  const { name, company, email, phone, address, budget, deadline, status, project_id, reference, notes } = req.body;
  try {
    const result = await pool.query(
      `UPDATE clients SET name=$1, company=$2, email=$3, phone=$4, address=$5,
       budget=$6, deadline=$7, status=$8, project_id=$9, reference=$10, notes=$11
       WHERE id=$12 AND board_id=$13 RETURNING *`,
      [name, company, email, phone, address, budget, deadline, status, project_id, reference, notes, req.params.id, req.user.boardId]
    );
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

// DELETE client
router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM clients WHERE id=$1 AND board_id=$2', [req.params.id, req.user.boardId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
