import { db } from '../database/datastore.js';
import { logger } from '../utils/logger.js';

export const logAuditEvent = async ({ userId, action, entity, entityId, details, req }) => {
  try {
    const ipAddress = req?.headers['x-forwarded-for'] || req?.socket?.remoteAddress || req?.ip || '127.0.0.1';
    const userAgent = req?.headers['user-agent'] || 'API Client';

    await db.createAuditLog({
      userId: userId || req?.user?.id || null,
      action,
      entity,
      entityId: entityId || null,
      details: details || {},
      ipAddress,
      userAgent,
    });
  } catch (err) {
    logger.error('Failed to write audit log event', err);
  }
};
