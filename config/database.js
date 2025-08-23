const mysql = require('mysql2/promise');
require('dotenv').config();

const dbConfig = {
  host: process.env.DB_HOST,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
  port: process.env.DB_PORT,
  ssl: {
    rejectUnauthorized: false
  },
  // Connection pool configuration
  connectionLimit: 10,
  queueLimit: 0,
  acquireTimeout: 60000,
  timeout: 60000,
  // Handle connection drops
  reconnect: true,
  idleTimeout: 300000,
  // Keep connections alive
  keepAliveInitialDelay: 0,
  enableKeepAlive: true
};

let pool;

const connectDB = async () => {
  try {
    pool = mysql.createPool(dbConfig);
    
    // Test the connection
    const connection = await pool.getConnection();
    console.log('MySQL Connected Successfully');
    connection.release();
    
    // Handle pool events
    pool.on('connection', (connection) => {
      console.log('New connection established as id ' + connection.threadId);
    });

    pool.on('error', (err) => {
      console.error('Database pool error:', err);
      if (err.code === 'PROTOCOL_CONNECTION_LOST') {
        console.log('Reconnecting to database...');
        connectDB();
      } else {
        throw err;
      }
    });

    return pool;
  } catch (error) {
    console.error('Database connection failed:', error);
    process.exit(1);
  }
};

const getConnection = () => {
  if (!pool) {
    throw new Error('Database pool not initialized');
  }
  return pool;
};

// Gracefully close the pool
const closeDB = async () => {
  if (pool) {
    await pool.end();
    console.log('Database pool closed');
  }
};

module.exports = { connectDB, getConnection, closeDB };