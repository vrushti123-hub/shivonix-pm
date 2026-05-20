const express = require('express');
const cors = require('cors');
const pool = require('./db');
require('dotenv').config();

const app = express();

app.use(cors({
  origin: '*',
  methods: ['GET','POST','PUT','DELETE','OPTIONS'],
  allowedHeaders: ['Content-Type','Authorization','X-Board-Id']
}));

app.use(express.json());

app.use('/api/auth',     require('./routes/auth'));
app.use('/api/projects', require('./routes/projects'));
app.use('/api/tasks',    require('./routes/tasks'));
app.use('/api/clients',  require('./routes/clients'));
app.use('/api/invoices', require('./routes/invoices'));
app.use('/api/boards',   require('./routes/boards'));
app.use('/api/alerts',   require('./routes/alerts'));
app.use('/api/time',     require('./routes/time'));

app.get('/', (req, res) => res.json({ status: 'Shivonix API running!' }));

const PORT = process.env.PORT || 8080;
pool.initSchema()
  .then(() => {
    app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch(err => {
    console.error('Database schema init failed:', err);
    process.exit(1);
  });
