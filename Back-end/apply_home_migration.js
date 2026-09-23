require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { getPool, sql, closePool } = require('./server/config/database');
(async () => {
  try {
    const fileName = process.argv[2] || 'migration_add_home_columns.sql';
    const file = path.join(__dirname, 'SQL', fileName);
    const text = fs.readFileSync(file, 'utf8');
    const batches = text.split(/^\s*GO\s*$/mi).map(s => s.trim()).filter(Boolean);
    const pool = await getPool();
    for (const b of batches) {
      console.log('--- batch ---');
      await pool.request().batch(b);
    }
    console.log('Migration OK');
  } catch (e) {
    console.error('Migration failed:', e.message);
    process.exitCode = 1;
  } finally { await closePool(); }
})();
