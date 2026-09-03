import { Router } from 'express';
import { BackfillController } from './backfill.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../../constants/permissions.js';

const router = Router();

router.use(requireAuth);

router.get('/stats', requirePermission(PERMISSIONS.VIEW_SYNC), BackfillController.getStats);
router.get('/campaigns', requirePermission(PERMISSIONS.VIEW_SYNC), BackfillController.getCampaigns);
router.post('/campaigns', requirePermission(PERMISSIONS.START_SYNC), BackfillController.createCampaign);
router.get('/campaigns/:id', requirePermission(PERMISSIONS.VIEW_SYNC), BackfillController.getCampaignById);
router.post('/campaigns/:id/pause', requirePermission(PERMISSIONS.PAUSE_DISCOVERY), BackfillController.pauseCampaign);
router.post('/campaigns/:id/resume', requirePermission(PERMISSIONS.RESUME_DISCOVERY), BackfillController.resumeCampaign);
router.post('/campaigns/:id/retry-failed', requirePermission(PERMISSIONS.RETRY_SYNC), BackfillController.retryFailedSegments);
router.post('/campaigns/:id/cancel', requirePermission(PERMISSIONS.CANCEL_DISCOVERY), BackfillController.cancelCampaign);

export default router;
