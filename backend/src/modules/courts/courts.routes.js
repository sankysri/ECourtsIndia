import { Router } from 'express';
import { CourtsController } from './courts.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../../constants/permissions.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission(PERMISSIONS.VIEW_COURTS), CourtsController.getCourts);
router.get('/hierarchy', requirePermission(PERMISSIONS.VIEW_COURTS), CourtsController.getHierarchy);
router.get('/metadata', requirePermission(PERMISSIONS.VIEW_COURTS), CourtsController.getMetadata);
router.post('/sync', requirePermission(PERMISSIONS.SYNC_COURTS), CourtsController.triggerSync);
router.get('/sync/status/:jobId', requirePermission(PERMISSIONS.VIEW_COURTS), CourtsController.getSyncStatus);
router.get('/:id', requirePermission(PERMISSIONS.VIEW_COURTS), CourtsController.getCourtById);
router.get('/:code/logs', requirePermission(PERMISSIONS.VIEW_COURTS), CourtsController.getCourtLogs);

export default router;
