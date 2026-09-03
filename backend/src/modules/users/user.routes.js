import { Router } from 'express';
import { UserController } from './user.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requirePermission } from '../../middleware/rbac.js';
import { PERMISSIONS } from '../../constants/permissions.js';

const router = Router();

router.use(requireAuth);
router.get('/profile', UserController.getProfile);
router.get('/', requirePermission(PERMISSIONS.VIEW_USERS), UserController.getAll);
router.get('/:id', requirePermission(PERMISSIONS.VIEW_USERS), UserController.getProfile);

export default router;
