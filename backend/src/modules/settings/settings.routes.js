import { Router } from 'express';
import { SettingsController } from './settings.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../../constants/permissions.js';

const router = Router();

router.use(requireAuth);

router.get('/config', requirePermission(PERMISSIONS.VIEW_SETTINGS), SettingsController.getSettings);
router.put('/config', requirePermission(PERMISSIONS.MANAGE_SETTINGS), SettingsController.updateSetting);
router.post('/purge-data', requirePermission(PERMISSIONS.MANAGE_SETTINGS), SettingsController.purgeOperationalData);
router.get('/audit-logs', requirePermission(PERMISSIONS.VIEW_AUDIT_LOGS), SettingsController.getAuditLogs);

export default router;
