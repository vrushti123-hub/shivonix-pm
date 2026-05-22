const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../db');

// REGISTER
router.post('/register', async (req, res) => {
  const { name, email, password } = req.body;
  if (!name || !email || !password)
    return res.status(400).json({ error: 'All fields required' });
  try {
    const exists = await pool.query('SELECT id FROM users WHERE email=$1', [email]);
    if (exists.rows.length > 0)
      return res.status(400).json({ error: 'Email already registered' });

    const hash = await bcrypt.hash(password, 10);
    const user = await pool.query(
      'INSERT INTO users (name, email, password_hash) VALUES ($1,$2,$3) RETURNING id, name, email',
      [name, email, hash]
    );

    const board = await pool.query(
      'INSERT INTO boards (owner_id, name) VALUES ($1,$2) RETURNING id',
      [user.rows[0].id, `${name}\'s Workspace`]
    );

    const defaultStages = ['Requirement Analysis','System Design','Development','Testing','UAT','Production / Live','Maintenance'];
    for (let i = 0; i < defaultStages.length; i++) {
      await pool.query(
        'INSERT INTO stages (board_id, name, position) VALUES ($1,$2,$3)',
        [board.rows[0].id, defaultStages[i], i]
      );
    }

    const token = jwt.sign(
      { id: user.rows[0].id, email, boardId: board.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({ token, user: user.rows[0], boardId: board.rows[0].id });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

// LOGIN
router.post('/login', async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'Email and password required' });
  try {
    const user = await pool.query('SELECT * FROM users WHERE email=$1', [email]);
    if (user.rows.length === 0)
      return res.status(400).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.rows[0].password_hash);
    if (!valid)
      return res.status(400).json({ error: 'Invalid email or password' });

    // Get their personal board. It is the first board created at registration.
    const board = await pool.query(
      'SELECT id FROM boards WHERE owner_id=$1 ORDER BY id ASC LIMIT 1',
      [user.rows[0].id]
    );
    if (!board.rows.length) {
      return res.status(500).json({ error: 'No personal board found for this account' });
    }

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
    await pool.query(`ALTER TABLE board_members ADD COLUMN IF NOT EXISTS access JSONB DEFAULT '{}'::jsonb`);

    // Get boards they joined through invites.
    const sharedBoards = await pool.query(
      `SELECT bm.board_id, b.name, bm.role, bm.access
       FROM board_members bm
       JOIN boards b ON b.id = bm.board_id
       WHERE bm.user_id=$1`,
      [user.rows[0].id]
    );

    // Get team boards they created themselves. These are not in board_members,
    // so they must be returned separately or they disappear after logout.
    const ownedTeamBoards = await pool.query(
      `SELECT id, name
       FROM boards
       WHERE owner_id=$1 AND id<>$2
       ORDER BY id ASC`,
      [user.rows[0].id, board.rows[0].id]
    );

    const token = jwt.sign(
      { id: user.rows[0].id, email, boardId: board.rows[0].id },
      process.env.JWT_SECRET,
      { expiresIn: '30d' }
    );

    res.json({
      token,
      user: { id: user.rows[0].id, name: user.rows[0].name, email },
      boardId: board.rows[0].id,
      sharedBoards: sharedBoards.rows.map(b => b.board_id),
      teamBoards: [
        ...ownedTeamBoards.rows.map(b => ({
          id: b.id,
          name: b.name || 'Team Board',
          role: 'owner',
          owned: true,
          access: null
        })),
        ...sharedBoards.rows.map(b => ({
        id: b.board_id,
        name: b.name || 'Team Board',
        role: b.role || 'editor',
        owned: false,
        access: b.access || null
        }))
      ]
    });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
