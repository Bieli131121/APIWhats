// src/config/database.js
// Pool de conexões PostgreSQL

const { Pool } = require('pg');
const logger = require('../utils/logger');

const pool = new Pool({
  host: process.env.DB_HOST,
  port: parseInt(process.env.DB_PORT || '5432'),
  database: process.env.DB_NAME,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  max: 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('connect', () => logger.info('PostgreSQL: nova conexão no pool'));
pool.on('error', (err) => logger.error('PostgreSQL: erro idle', err));

const query = async (text, params) => {
  const start = Date.now();
  try {
    const result = await pool.query(text, params);
    const duration = Date.now() - start;
    if (duration > 1000) logger.warn(`Query lenta (${duration}ms): ${text}`);
    return result;
  } catch (error) {
    logger.error('Erro na query:', { text, error: error.message });
    throw error;
  }
};

const getClient = () => pool.connect();

module.exports = { query, getClient, pool };
