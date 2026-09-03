import { UserService } from './user.service.js';
import { successResponse } from '../../utils/apiResponse.js';

export class UserController {
  static async getAll(req, res, next) {
    try {
      const users = await UserService.getAllUsers();
      return successResponse(res, 'Users retrieved successfully', { users });
    } catch (err) {
      next(err);
    }
  }

  static async getProfile(req, res, next) {
    try {
      const profile = await UserService.getUserProfile(req.params.id || req.user.id);
      return successResponse(res, 'User profile retrieved', { profile });
    } catch (err) {
      next(err);
    }
  }
}
