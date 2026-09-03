import { SettingsService } from './settings.service.js';
import { successResponse } from '../../utils/apiResponse.js';

export class SettingsController {
  static async getSettings(req, res, next) {
    try {
      const isSuperAdmin = req.user?.roles?.includes('SUPER_ADMIN');
      const settings = await SettingsService.getSettings({ includePrivate: isSuperAdmin });
      return successResponse(res, 'System settings retrieved', { settings });
    } catch (err) {
      next(err);
    }
  }

  static async updateSetting(req, res, next) {
    try {
      const { key, value, description, isPublic } = req.body;
      const updated = await SettingsService.updateSetting({ key, value, description, isPublic, req });
      return successResponse(res, 'Setting updated successfully', { setting: updated });
    } catch (err) {
      next(err);
    }
  }

  static async getAuditLogs(req, res, next) {
    try {
      const limit = parseInt(req.query.limit || '50', 10);
      const offset = parseInt(req.query.offset || '0', 10);
      const logs = await SettingsService.getAuditLogs({ limit, offset });
      return successResponse(res, 'Audit logs retrieved', { logs, total: logs.length });
    } catch (err) {
      next(err);
    }
  }

  static async purgeOperationalData(req, res, next) {
    try {
      const cleared = await SettingsService.purgeOperationalData({ req });
      return successResponse(res, 'All operational dummy data has been successfully purged.', { cleared });
    } catch (err) {
      next(err);
    }
  }
}
