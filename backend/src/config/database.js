import pg from 'pg';
import { env } from './env.js';
import { logger } from '../utils/logger.js';

const { Pool } = pg;

export let isDbConnected = false;
export let dbError = null;

// Automatically normalize Neon pooled URL and parameters to direct endpoint
let normalizedDbUrl = env.DATABASE_URL;
if (normalizedDbUrl && typeof normalizedDbUrl === 'string') {
  normalizedDbUrl = normalizedDbUrl.replace('-pooler.', '.');
  normalizedDbUrl = normalizedDbUrl.replace(/[?&]channel_binding=[^&]+/g, '');
  if (normalizedDbUrl.includes('&') && !normalizedDbUrl.includes('?')) {
    normalizedDbUrl = normalizedDbUrl.replace('&', '?');
  }
}

const isCloudDb = 
  normalizedDbUrl.includes('neon.tech') || 
  normalizedDbUrl.includes('sslmode') || 
  normalizedDbUrl.includes('render.com') ||
  normalizedDbUrl.includes('aws') || 
  env.DB_SSL;

export const pool = new Pool({
  connectionString: normalizedDbUrl,
  ssl: isCloudDb ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on('error', (err) => {
  logger.error('Unexpected error on idle PostgreSQL client', err);
  isDbConnected = false;
  dbError = err.message;
});

export const testDbConnection = async (retries = 3) => {
  for (let i = 0; i < retries; i++) {
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
      logger.warn(`PostgreSQL connection attempt ${i + 1}/${retries} failed: ${err.message}`);
      if (i < retries - 1) {
        await new Promise((r) => setTimeout(r, 2000));
      }
    }
  }
  return false;
};

// Safe query execution wrapper
export const query = async (text, params) => {
  try {
    const start = Date.now();
    const res = await pool.query(text, params);
    isDbConnected = true;
    dbError = null;
    const duration = Date.now() - start;
    logger.debug('Executed PostgreSQL query', { text: text.substring(0, 100), duration, rows: res.rowCount });
    return res;
  } catch (err) {
    if (!isDbConnected && dbError) {
      throw new Error(`Database connection failure: ${dbError}`);
    }
    throw err;
  }
};
