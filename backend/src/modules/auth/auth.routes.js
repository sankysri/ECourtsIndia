import { Router } from 'express';
import { AuthController } from './auth.controller.js';
import { requireAuth } from '../../middleware/auth.js';
import { requireSuperAdmin } from '../../middleware/rbac.js';
import { validateBody } from '../../middleware/validate.js';
import { loginSchema, refreshSchema, registerSeedSchema } from './auth.schema.js';

const router = Router();

// Public routes
router.post('/login', validateBody(loginSchema), AuthController.login);
router.post('/refresh', validateBody(refreshSchema), AuthController.refresh);

// Protected routes
router.post('/logout', requireAuth, AuthController.logout);
router.get('/me', requireAuth, AuthController.me);

// Seed/Admin route for creating new platform operators
router.post('/seed-user', requireAuth, requireSuperAdmin, validateBody(registerSeedSchema), AuthController.registerSeed);

export default router;
