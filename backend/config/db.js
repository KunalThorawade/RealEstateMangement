require('dotenv').config();
const mysql = require('mysql2');

const db = mysql.createPool({
  host:     process.env.DB_HOST     || 'localhost',
  user:     process.env.DB_USER     || 'root',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME     || 'real_estate_db'
});

db.getConnection((err, conn) => {
  if (err) {
    console.error('MySQL error ', err);
  } else {
    console.log('Connected to MySQL');
    conn.release();
  }
});

module.exports = db;
