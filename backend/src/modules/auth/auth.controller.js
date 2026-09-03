import { AuthService } from './auth.service.js';
import { successResponse } from '../../utils/apiResponse.js';

export class AuthController {
  static async login(req, res, next) {
    try {
      const { email, password, rememberMe } = req.body;
      const result = await AuthService.login({ email, password, req });
      return successResponse(res, 'Authentication successful', result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async refresh(req, res, next) {
    try {
      const { refreshToken } = req.body;
      const result = await AuthService.refreshToken({ refreshToken });
      return successResponse(res, 'Tokens refreshed successfully', result, 200);
    } catch (err) {
      next(err);
    }
  }

  static async logout(req, res, next) {
    try {
      await AuthService.logout({ userId: req.user?.id, req });
      return successResponse(res, 'Logged out successfully', {}, 200);
    } catch (err) {
      next(err);
    }
  }

  static async me(req, res, next) {
    try {
      return successResponse(res, 'Current user profile retrieved', { user: req.user }, 200);
    } catch (err) {
      next(err);
    }
  }

  static async registerSeed(req, res, next) {
    try {
      const result = await AuthService.seedUser(req.body);
      return successResponse(res, 'User created successfully', result, 201);
    } catch (err) {
      next(err);
    }
  }
}
