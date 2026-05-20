const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
router.use(auth);

router.get('/', async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM tasks WHERE board_id=$1 ORDER BY created_at DESC',
      [req.user.boardId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/', async (req, res) => {
  const { title, description, project_id, status, priority, assignee_email, due_date, module, send_notification } = req.body;
  try {
    const result = await pool.query(
      `INSERT INTO tasks (board_id, project_id, title, description, status, priority, assignee_email, due_date, module)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9) RETURNING *`,
      [req.user.boardId, project_id, title, description, status, priority, assignee_email, due_date, module]
    );
    if (assignee_email && send_notification !== false) {
      try {
        await resend.emails.send({
          from: 'Shivonix PM <noreply@shivonixtech.com>',
          to: assignee_email,
          subject: `Task Assigned: ${title}`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f9f9;border-radius:12px;">
            <h2 style="color:#6c63ff;">📋 New Task Assigned</h2>
            <p>A new task has been assigned to you on <b>Shivonix PM</b>.</p>
            <div style="background:#fff;padding:16px;border-radius:8px;border-left:4px solid #6c63ff;">
              <b>Task:</b> ${title}<br/>
              <b>Priority:</b> ${priority || 'Medium'}<br/>
              <b>Due Date:</b> ${due_date || 'Not set'}<br/>
              ${description ? `<b>Description:</b> ${description}` : ''}
            </div>
            <p style="color:#888;font-size:12px;margin-top:24px;">Shivonix Project Management · shivonixtech.com</p>
          </div>`
        });
      } catch(e) { console.error('Email error:', e.message); }
    }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:id', async (req, res) => {
  const { title, description, project_id, status, priority, assignee_email, due_date, module, send_notification } = req.body;
  try {
    const prev = await pool.query('SELECT assignee_email FROM tasks WHERE id=$1', [req.params.id]);
    const prevEmail = prev.rows[0]?.assignee_email;
    const result = await pool.query(
      `UPDATE tasks SET title=$1, description=$2, project_id=$3, status=$4,
       priority=$5, assignee_email=$6, due_date=$7, module=$8
       WHERE id=$9 AND board_id=$10 RETURNING *`,
      [title, description, project_id, status, priority, assignee_email, due_date, module, req.params.id, req.user.boardId]
    );
    if (assignee_email && assignee_email !== prevEmail && send_notification !== false) {
      try {
        await resend.emails.send({
          from: 'Shivonix PM <noreply@shivonixtech.com>',
          to: assignee_email,
          subject: `Task Assigned: ${title}`,
          html: `<div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f9f9;border-radius:12px;">
            <h2 style="color:#6c63ff;">📋 Task Assigned to You</h2>
            <p>A task has been assigned to you on <b>Shivonix PM</b>.</p>
            <div style="background:#fff;padding:16px;border-radius:8px;border-left:4px solid #6c63ff;">
              <b>Task:</b> ${title}<br/>
              <b>Priority:</b> ${priority || 'Medium'}<br/>
              <b>Due Date:</b> ${due_date || 'Not set'}
            </div>
            <p style="color:#888;font-size:12px;margin-top:24px;">Shivonix Project Management · shivonixtech.com</p>
          </div>`
        });
      } catch(e) { console.error('Email error:', e.message); }
    }
    res.json(result.rows[0]);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:id', async (req, res) => {
  try {
    await pool.query('DELETE FROM tasks WHERE id=$1 AND board_id=$2', [req.params.id, req.user.boardId]);
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;

// Helper - check and send due date alert for a single task
async function sendDueDateAlert(task, resend) {
  if (!task.due_date || task.status === 'Done') return;
  const today = new Date();
  const due = new Date(task.due_date);
  const diffDays = Math.ceil((due - today) / (1000 * 60 * 60 * 24));
  
  if ([1, 3, 7].includes(diffDays)) {
    const emailTo = task.assignee_email;
    if (!emailTo) return;
    try {
      await resend.emails.send({
        from: 'Shivonix PM <noreply@shivonixtech.com>',
        to: emailTo,
        subject: `⏰ Task Due in ${diffDays} day${diffDays > 1 ? 's' : ''}: ${task.title}`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f9f9;border-radius:12px;">
            <h2 style="color:#6c63ff;">⏰ Task Due Soon!</h2>
            <p>A task assigned to you is due in <b>${diffDays} day${diffDays > 1 ? 's' : ''}</b>.</p>
            <div style="background:#fff;padding:16px;border-radius:8px;border-left:4px solid #6c63ff;">
              <b>Task:</b> ${task.title}<br/>
              <b>Due Date:</b> ${task.due_date.toString().split('T')[0]}<br/>
              <b>Priority:</b> ${task.priority || 'Medium'}<br/>
              <b>Status:</b> ${task.status}
            </div>
            <p style="color:#888;font-size:12px;margin-top:24px;">Shivonix Project Management · shivonixtech.com</p>
          </div>
        `
      });
      console.log(`Due date alert sent to ${emailTo} for task: ${task.title}`);
    } catch(e) { console.error('Due alert error:', e.message); }
  }
}
