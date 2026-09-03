import { Router } from 'express';
import { QueueController } from './queue.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../../constants/permissions.js';

const router = Router();

// Queue status & test job endpoints
router.get('/status', QueueController.getStatus);
router.post('/test-job', requireAuth, requirePermission(PERMISSIONS.START_SYNC), QueueController.triggerTest);

export default router;
