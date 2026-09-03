import { db } from './datastore.js';
import { logger } from '../utils/logger.js';
import { testDbConnection } from '../config/database.js';

export const purgeOperationalData = async () => {
  logger.info('Connecting to database to purge test and dummy records...');
  await testDbConnection();

  const cleared = await db.clearOperationalData();
  logger.info('Successfully purged operational records:', cleared);
  return cleared;
};

if (process.argv[1] && process.argv[1].endsWith('purge.js')) {
  purgeOperationalData()
    .then((res) => {
      console.log('Operational dummy data cleared successfully:', res);
      process.exit(0);
    })
    .catch((err) => {
      console.error('Failed to purge dummy data:', err);
      process.exit(1);
    });
}
