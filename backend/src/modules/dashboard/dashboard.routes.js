import { Router } from 'express';
import { DashboardController } from './dashboard.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../../constants/permissions.js';

const router = Router();

router.use(requireAuth);

router.get('/summary', requirePermission(PERMISSIONS.VIEW_DASHBOARD), DashboardController.getSummary);
router.get('/system-health', requirePermission(PERMISSIONS.VIEW_DASHBOARD), DashboardController.getSystemHealth);
router.get('/recent-activity', requirePermission(PERMISSIONS.VIEW_DASHBOARD), DashboardController.getRecentActivity);
router.get('/queue-status', requirePermission(PERMISSIONS.VIEW_DASHBOARD), DashboardController.getQueueStatus);

export default router;
