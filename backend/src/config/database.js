import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export let isDbConnected = false;
export let dbError = null;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', err);
  isDbConnected = false;
  dbError = err.message;
});

export const testDbConnection = async () => {
  try {
    const client = await pool.connect();
    const res = await client.query('SELECT NOW() as current_time');
    client.release();
    isDbConnected = true;
    dbError = null;
    logger.info('PostgreSQL connected successfully', { time: res.rows[0].current_time });
    return true;
  } catch (err) {
    isDbConnected = false;
    dbError = err.message;
    logger.warn(`PostgreSQL connection failed (${err.message}). In-memory fallback will be active if needed.`);
    return false;
  }
};

// Safe query execution wrapper
export const query = async (text, params) => {
  if (isDbConnected) {
    const start = Date.now();
    const res = await pool.query(text, params);
    const duration = Date.now() - start;
    logger.debug('Executed PostgreSQL query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    return res;
  }
  throw new Error(`Database is not connected: ${dbError || 'Unknown connection failure'}`);
};
