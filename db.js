const { Pool } = require('pg');

// Render inatoa DATABASE_URL automatically kwenye Environment Variables
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Hii ni lazima kwa Render PostgreSQL
  }
});

module.exports = pool;