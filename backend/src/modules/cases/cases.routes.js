import { Router } from 'express';
import { CasesController } from './cases.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../../constants/permissions.js';

const router = Router();

router.use(requireAuth);

router.get('/', requirePermission(PERMISSIONS.VIEW_CASES), CasesController.getCases);
router.post('/batch-sync', requirePermission(PERMISSIONS.START_SYNC), CasesController.batchSyncPendingCases);
router.get('/:cnr', requirePermission(PERMISSIONS.VIEW_CASES), CasesController.getCaseByCnr);
router.get('/:cnr/raw', requirePermission(PERMISSIONS.VIEW_RAW_API_DATA), CasesController.getRawCaseSource);
router.post('/:cnr/sync', requirePermission(PERMISSIONS.START_SYNC), CasesController.triggerCaseDetailSync);

export default router;
