const router = require('express').Router();
const pool = require('../db');
const auth = require('../middleware/auth');
const { Resend } = require('resend');
const crypto = require('crypto');

const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
const DEFAULT_ACCESS = { workspace: true, finance: true, manage: true, account: false };

function normalizeAccess(access) {
  if (typeof access === 'string') {
    try { access = JSON.parse(access); } catch (_) { access = null; }
  }
  return ['workspace', 'finance', 'manage', 'account'].reduce((obj, key) => {
    obj[key] = access && Object.prototype.hasOwnProperty.call(access, key)
      ? access[key] !== false
      : DEFAULT_ACCESS[key] !== false;
    return obj;
  }, {});
}

async function ensureBoardInviteSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS board_members (
      board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
      user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      role TEXT DEFAULT 'editor',
      invited_by INTEGER REFERENCES users(id),
      access JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now(),
      PRIMARY KEY (board_id, user_id)
    )
  `);
  await pool.query(`
    CREATE TABLE IF NOT EXISTS board_invites (
      id SERIAL PRIMARY KEY,
      board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
      invited_email TEXT NOT NULL,
      token TEXT UNIQUE NOT NULL,
      role TEXT DEFAULT 'editor',
      invited_by INTEGER REFERENCES users(id),
      accepted BOOLEAN DEFAULT false,
      expires_at TIMESTAMPTZ DEFAULT (now() + interval '7 days'),
      access JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
  await pool.query(`ALTER TABLE board_members ADD COLUMN IF NOT EXISTS access JSONB DEFAULT '{}'::jsonb`);
  await pool.query(`ALTER TABLE board_invites ADD COLUMN IF NOT EXISTS access JSONB DEFAULT '{}'::jsonb`);
}

function frontendBaseUrl(req) {
  return (process.env.FRONTEND_URL || req.headers.origin || '').replace(/\/$/, '');
}

async function sendInviteEmail(email, boardName, inviteLink) {
  if (!resend) return { sent: false, error: 'RESEND_API_KEY is not configured' };
  try {
    await resend.emails.send({
      from: process.env.RESEND_FROM || 'Shivonix PM <noreply@shivonixtech.com>',
      to: email,
      subject: `You have been invited to ${boardName || 'a Shivonix board'}`,
      html: `
        <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f9f9f9;border-radius:12px;">
          <h2 style="color:#6c63ff;">Board Invitation</h2>
          <p>You have been invited to collaborate on <b>${boardName || 'a Shivonix PM board'}</b>.</p>
          <a href="${inviteLink}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#6c63ff;color:#fff;border-radius:8px;text-decoration:none;font-weight:600;">Accept Invitation</a>
          <p style="color:#888;font-size:12px;margin-top:24px;">Link expires in 7 days.</p>
        </div>
      `
    });
    return { sent: true };
  } catch (err) {
    console.error('Invite email error:', err.message);
    return { sent: false, error: err.message };
  }
}

// Accept invite - no auth needed
router.post('/accept-invite', async (req, res) => {
  const { token, userId } = req.body;
  try {
    await ensureBoardInviteSchema();
    const invite = await pool.query(
      `SELECT bi.*, b.name AS board_name
       FROM board_invites bi
       JOIN boards b ON b.id = bi.board_id
       WHERE bi.token=$1 AND bi.accepted=false AND bi.expires_at > now()`,
      [token]
    );
    if (!invite.rows.length)
      return res.status(400).json({ error: 'Invalid or expired invite' });
    const inv = invite.rows[0];
    const access = normalizeAccess(inv.access);
    await pool.query(
      `INSERT INTO board_members (board_id, user_id, role, invited_by, access)
       VALUES ($1,$2,$3,$4,$5::jsonb)
       ON CONFLICT (board_id, user_id)
       DO UPDATE SET role=EXCLUDED.role, invited_by=EXCLUDED.invited_by, access=EXCLUDED.access`,
      [inv.board_id, userId, inv.role, inv.invited_by, JSON.stringify(access)]
    );
    await pool.query(`UPDATE board_invites SET accepted=true WHERE id=$1`, [inv.id]);
    res.json({ success: true, boardId: inv.board_id, boardName: inv.board_name, access });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.use(auth);

router.post('/create-team', async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Board name required' });
  try {
    await ensureBoardInviteSchema();
    const board = await pool.query(
      `INSERT INTO boards (owner_id, name) VALUES ($1,$2) RETURNING id, name`,
      [req.user.id, name.trim()]
    );
    const defaultStages = ['Requirement Analysis','System Design','Development','Testing','UAT','Production / Live','Maintenance'];
    for (let i = 0; i < defaultStages.length; i++) {
      await pool.query(
        `INSERT INTO stages (board_id, name, position) VALUES ($1,$2,$3) ON CONFLICT DO NOTHING`,
        [board.rows[0].id, defaultStages[i], i]
      );
    }
    res.json({ success: true, boardId: board.rows[0].id, boardName: board.rows[0].name });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.put('/:boardId', async (req, res) => {
  const { name } = req.body;
  try {
    await ensureBoardInviteSchema();
    const boardId = req.params.boardId;
    const owner = await pool.query('SELECT id FROM boards WHERE id=$1 AND owner_id=$2', [boardId, req.user.id]);
    if (!owner.rows.length) return res.status(403).json({ error: 'Only the board owner can edit this board' });
    if (name && name.trim()) {
      await pool.query('UPDATE boards SET name=$1 WHERE id=$2', [name.trim(), boardId]);
    }
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.get('/members', async (req, res) => {
  try {
    await ensureBoardInviteSchema();
    const result = await pool.query(
      `SELECT u.id, u.name, u.email, bm.role, bm.access FROM board_members bm
       JOIN users u ON u.id = bm.user_id
       WHERE bm.board_id=$1`,
      [req.user.boardId]
    );
    res.json(result.rows);
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.post('/invite', async (req, res) => {
  const { email, role, access, boardId } = req.body;
  const targetBoardId = boardId || req.user.boardId;
  if (!email || !email.trim()) return res.status(400).json({ error: 'Email required' });
  try {
    await ensureBoardInviteSchema();
    const board = await pool.query('SELECT id, name FROM boards WHERE id=$1', [targetBoardId]);
    if (!board.rows.length) return res.status(404).json({ error: 'Board not found' });

    const memberAccess = normalizeAccess(access);
    const token = crypto.randomBytes(32).toString('hex');
    await pool.query(
      `INSERT INTO board_invites (board_id, invited_email, token, role, invited_by, access)
       VALUES ($1,$2,$3,$4,$5,$6::jsonb)`,
      [targetBoardId, email.trim(), token, role || 'editor', req.user.id, JSON.stringify(memberAccess)]
    );
    const base = frontendBaseUrl(req);
    const inviteLink = base ? `${base}?token=${token}` : `?token=${token}`;
    const emailResult = await sendInviteEmail(email.trim(), board.rows[0].name, inviteLink);
    res.json({
      success: true,
      inviteLink,
      token,
      emailSent: emailResult.sent,
      emailError: emailResult.error || null,
      access: memberAccess
    });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/members/:userId', async (req, res) => {
  try {
    await pool.query(
      'DELETE FROM board_members WHERE board_id=$1 AND user_id=$2',
      [req.user.boardId, req.params.userId]
    );
    res.json({ success: true });
  } catch (err) { res.status(500).json({ error: err.message }); }
});

router.delete('/:boardId', async (req, res) => {
  const boardId = req.params.boardId;
  try {
    await ensureBoardInviteSchema();

    if (String(req.user.homeBoardId || '') === String(boardId)) {
      return res.status(400).json({ error: 'Personal board cannot be deleted' });
    }

    const owner = await pool.query(
      'SELECT id FROM boards WHERE id=$1 AND owner_id=$2',
      [boardId, req.user.id]
    );
    if (!owner.rows.length) {
      return res.status(403).json({ error: 'Only the board owner can delete this board' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      await client.query('DELETE FROM time_entries WHERE board_id=$1', [boardId]);
      await client.query('DELETE FROM invoices WHERE board_id=$1', [boardId]);
      await client.query('DELETE FROM clients WHERE board_id=$1', [boardId]);
      await client.query('DELETE FROM tasks WHERE board_id=$1', [boardId]);
      await client.query('DELETE FROM projects WHERE board_id=$1', [boardId]);
      await client.query('DELETE FROM stages WHERE board_id=$1', [boardId]);
      await client.query('DELETE FROM board_invites WHERE board_id=$1', [boardId]);
      await client.query('DELETE FROM board_members WHERE board_id=$1', [boardId]);
      await client.query('DELETE FROM boards WHERE id=$1 AND owner_id=$2', [boardId, req.user.id]);
      await client.query('COMMIT');
      res.json({ success: true });
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  } catch (err) { res.status(500).json({ error: err.message }); }
});

module.exports = router;
