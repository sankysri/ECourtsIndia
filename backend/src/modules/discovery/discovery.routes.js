import { Router } from 'express';
import { DiscoveryController } from './discovery.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../../constants/permissions.js';

const router = Router();

router.use(requireAuth);

// Daily Discovery endpoints (M6)
router.get('/daily/status', requirePermission(PERMISSIONS.VIEW_DISCOVERY), DiscoveryController.getDailyStatus);
router.put('/daily/config', requirePermission(PERMISSIONS.START_DISCOVERY), DiscoveryController.updateDailyConfig);
router.post('/daily/trigger', requirePermission(PERMISSIONS.START_DISCOVERY), DiscoveryController.triggerDailyDiscovery);
router.get('/daily/history', requirePermission(PERMISSIONS.VIEW_DISCOVERY), DiscoveryController.getDailyHistory);

// Registry endpoints
router.get('/registry', requirePermission(PERMISSIONS.VIEW_CASES), DiscoveryController.getRegistry);
router.get('/registry/stats', requirePermission(PERMISSIONS.VIEW_CASES), DiscoveryController.getRegistryStats);
router.get('/filters', requirePermission(PERMISSIONS.VIEW_DISCOVERY), DiscoveryController.getFiltersMetadata);

// Job endpoints
router.post('/jobs', requirePermission(PERMISSIONS.START_DISCOVERY), DiscoveryController.createJob);
router.get('/jobs', requirePermission(PERMISSIONS.VIEW_DISCOVERY), DiscoveryController.getJobs);
router.get('/jobs/:id', requirePermission(PERMISSIONS.VIEW_DISCOVERY), DiscoveryController.getJobById);
router.post('/jobs/:id/pause', requirePermission(PERMISSIONS.PAUSE_DISCOVERY), DiscoveryController.pauseJob);
router.post('/jobs/:id/resume', requirePermission(PERMISSIONS.RESUME_DISCOVERY), DiscoveryController.resumeJob);
router.post('/jobs/:id/retry', requirePermission(PERMISSIONS.RETRY_DISCOVERY), DiscoveryController.retryJob);
router.post('/jobs/:id/cancel', requirePermission(PERMISSIONS.CANCEL_DISCOVERY), DiscoveryController.cancelJob);

export default router;
