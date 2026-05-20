const fs = require('fs');

const required = [
  'index.js',
  'db.js',
  'middleware/auth.js',
  'routes/auth.js',
  'routes/projects.js',
  'routes/tasks.js',
  'routes/clients.js',
  'routes/invoices.js',
  'routes/boards.js',
  'routes/alerts.js',
  'routes/time.js'
];

const missing = required.filter(file => !fs.existsSync(file));

console.log('Deploy file check:', required.filter(file => fs.existsSync(file)).join(', '));

if (missing.length) {
  console.error('Missing deploy files:', missing.join(', '));
  process.exit(1);
}
