import { db } from '../../database/datastore.js';
import { logAuditEvent } from '../../middleware/audit.js';

export class SettingsService {
  static async getSettings({ includePrivate = false }) {
    const settings = await db.getSettings();
    if (includePrivate) return settings;
    return settings.filter((s) => s.is_public);
  }

  static async updateSetting({ key, value, description, isPublic, req }) {
    const existing = await db.getSettingByKey(key);
    const updated = await db.setSetting(key, value, description || existing?.description || '', isPublic ?? existing?.is_public ?? false);

    await logAuditEvent({
      userId: req.user?.id,
      action: 'SETTING_UPDATED',
      entity: 'SYSTEM_SETTINGS',
      entityId: key,
      details: {
        key,
        previousValue: existing?.value,
        newValue: value,
      },
      req,
    });

    return updated;
  }

  static async getAuditLogs({ limit = 50, offset = 0 }) {
    return db.getAuditLogs(limit, offset);
  }

  static async purgeOperationalData({ req }) {
    const cleared = await db.clearOperationalData();

    await logAuditEvent({
      userId: req.user?.id,
      action: 'OPERATIONAL_DATA_PURGED',
      entity: 'DATABASE',
      entityId: 'ALL_OPERATIONAL_TABLES',
      details: {
        clearedRecords: cleared,
        reason: 'Administrator requested complete purge of dummy/test operational data',
      },
      req,
    });

    return cleared;
  }
}
