import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { isDbConnected, pool, testDbConnection } from '../config/database.js';
import { logger } from '../utils/logger.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export const runMigrations = async () => {
  logger.info('Running database migrations...');
  const connected = await testDbConnection();

  if (!connected) {
    logger.warn('Skipping SQL migrations execution: PostgreSQL is not connected. Datastore fallback is active.');
    return { success: true, mode: 'memory-fallback' };
  }

  try {
    const schemaPath = path.join(__dirname, 'schema.sql');
    const sql = fs.readFileSync(schemaPath, 'utf8');
    await pool.query(sql);
    logger.info('Database migrations applied successfully.');
    return { success: true, mode: 'postgresql' };
  } catch (err) {
    logger.error('Database migration error', err);
    throw err;
  }
};

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runMigrations()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}
