const { Pool } = require('pg');
require('dotenv').config();

const databaseUrl = process.env.DATABASE_URL || '';

const pool = new Pool({
  connectionString: databaseUrl,
  ssl: databaseUrl.includes('railway.internal') 
    ? false 
    : { rejectUnauthorized: false }
});

pool.initSchema = async function initSchema() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS users (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS boards (
      id SERIAL PRIMARY KEY,
      owner_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS stages (
      id SERIAL PRIMARY KEY,
      board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      position INTEGER DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS projects (
      id SERIAL PRIMARY KEY,
      board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      client TEXT,
      description TEXT,
      phase TEXT,
      status TEXT,
      start_date DATE,
      end_date DATE,
      budget NUMERIC DEFAULT 0,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS tasks (
      id SERIAL PRIMARY KEY,
      board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
      project_id INTEGER,
      title TEXT NOT NULL,
      description TEXT,
      status TEXT,
      priority TEXT,
      assignee_email TEXT,
      due_date DATE,
      module TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS clients (
      id SERIAL PRIMARY KEY,
      board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
      project_id INTEGER,
      name TEXT NOT NULL,
      company TEXT,
      email TEXT,
      phone TEXT,
      address TEXT,
      budget NUMERIC DEFAULT 0,
      deadline DATE,
      status TEXT,
      reference TEXT,
      notes TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS invoices (
      id SERIAL PRIMARY KEY,
      board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
      client_id INTEGER,
      project_id INTEGER,
      invoice_type TEXT,
      number TEXT,
      status TEXT,
      date DATE,
      due_date DATE,
      line_items JSONB DEFAULT '[]'::jsonb,
      gst NUMERIC DEFAULT 0,
      discount NUMERIC DEFAULT 0,
      total NUMERIC DEFAULT 0,
      notes TEXT,
      bank_details TEXT,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS time_entries (
      id SERIAL PRIMARY KEY,
      board_id INTEGER REFERENCES boards(id) ON DELETE CASCADE,
      task_id INTEGER,
      project_id INTEGER,
      description TEXT,
      duration_minutes INTEGER DEFAULT 0,
      date DATE,
      created_at TIMESTAMPTZ DEFAULT now()
    )
  `);
};

module.exports = pool;
