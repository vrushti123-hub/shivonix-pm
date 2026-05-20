const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { Resend } = require('resend');

const resend = new Resend(process.env.RESEND_API_KEY);
router.use(auth);

router.post('/check', async (req, res) => {
  try {
    const boardId = req.user.boardId;
    const today = new Date();
    const alertDays = [1, 3, 7];
    let emailsSent = 0;

    for (const days of alertDays) {
      const targetDate = new Date(today);
      targetDate.setDate(today.getDate() + days);
      const dateStr = targetDate.toISOString().split('T')[0];

      // Check tasks
      const tasks = await pool.query(
        `SELECT t.*, u.email as owner_email, u.name as owner_name 
         FROM tasks t
         JOIN boards b ON b.id = t.board_id
         JOIN users u ON u.id = b.owner_id
         WHERE t.board_id = $1 
         AND t.due_date::date = $2::date
         AND t.status != 'Done'`,
        [boardId, dateStr]
      );

      for (const task of tasks.rows) {
        const emailTo = task.assignee_email || task.owner_email;
        if (!emailTo) continue;
        try {
          await resend.emails.send({
            from: 'Shivonix PM <noreply@shivonixtech.com>',
            to: emailTo,
            subject: `⏰ Task Due in ${days} day${days > 1 ? 's' : ''}: ${task.title}`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f9f9;border-radius:12px;">
                <h2 style="color:#6c63ff;">⏰ Task Due Soon!</h2>
                <p>A task is due in <b>${days} day${days > 1 ? 's' : ''}</b>.</p>
                <div style="background:#fff;padding:16px;border-radius:8px;border-left:4px solid #6c63ff;">
                  <b>Task:</b> ${task.title}<br/>
                  <b>Due Date:</b> ${dateStr}<br/>
                  <b>Priority:</b> ${task.priority || 'Medium'}<br/>
                  <b>Status:</b> ${task.status}
                </div>
                <p style="color:#888;font-size:12px;margin-top:24px;">Shivonix Project Management · shivonixtech.com</p>
              </div>
            `
          });
          emailsSent++;
        } catch(e) { console.error('Task alert email error:', e.message); }
      }

      // Check projects
      const projects = await pool.query(
        `SELECT p.*, u.email as owner_email, u.name as owner_name
         FROM projects p
         JOIN boards b ON b.id = p.board_id
         JOIN users u ON u.id = b.owner_id
         WHERE p.board_id = $1
         AND p.end_date::date = $2::date
         AND p.status != 'Completed'`,
        [boardId, dateStr]
      );

      for (const project of projects.rows) {
        try {
          await resend.emails.send({
            from: 'Shivonix PM <noreply@shivonixtech.com>',
            to: project.owner_email,
            subject: `🚨 Project Due in ${days} day${days > 1 ? 's' : ''}: ${project.name}`,
            html: `
              <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f9f9;border-radius:12px;">
                <h2 style="color:#ff6b6b;">🚨 Project Deadline Alert!</h2>
                <p>A project deadline is approaching in <b>${days} day${days > 1 ? 's' : ''}</b>.</p>
                <div style="background:#fff;padding:16px;border-radius:8px;border-left:4px solid #ff6b6b;">
                  <b>Project:</b> ${project.name}<br/>
                  <b>Client:</b> ${project.client || 'N/A'}<br/>
                  <b>Due Date:</b> ${dateStr}<br/>
                  <b>Status:</b> ${project.status}
                </div>
                <p style="color:#888;font-size:12px;margin-top:24px;">Shivonix Project Management · shivonixtech.com</p>
              </div>
            `
          });
          emailsSent++;
        } catch(e) { console.error('Project alert email error:', e.message); }
      }
    }

    res.json({ success: true, emailsSent });
  } catch (err) {
    console.error('Alert check error:', err);
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
