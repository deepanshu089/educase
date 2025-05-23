const mysql = require('mysql2');

const pool = mysql.createPool({
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  waitForConnections: true,
  connectionLimit: 10,
  queueLimit: 0,
  ssl: false,  // Changed this line
  enableKeepAlive: true,
  keepAliveInitialDelay: 0
}).promise();

// Add connection error handling
pool.on('error', (err) => {
  console.error('Database connection error:', err);
});

module.exports = pool;