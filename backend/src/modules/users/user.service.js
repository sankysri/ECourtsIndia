import { db, memStore } from '../../database/datastore.js';
import { isDbConnected, query } from '../../config/database.js';

export class UserService {
  static async getAllUsers() {
    if (isDbConnected) {
      const res = await query(
        `SELECT u.id, u.email, u.first_name, u.last_name, u.is_active, u.last_login_at, u.created_at,
                ARRAY_AGG(r.name) as roles
         FROM users u
         LEFT JOIN user_roles ur ON ur.user_id = u.id
         LEFT JOIN roles r ON r.id = ur.role_id
         GROUP BY u.id
         ORDER BY u.created_at DESC`
      );
      return res.rows;
    }
    return Array.from(memStore.users.values()).map((u) => ({
      id: u.id,
      email: u.email,
      first_name: u.first_name,
      last_name: u.last_name,
      is_active: u.is_active,
      last_login_at: u.last_login_at,
      created_at: u.created_at,
      roles: Array.from(memStore.userRoles.get(u.id) || ['READ_ONLY']),
    }));
  }

  static async getUserProfile(userId) {
    const user = await db.findUserById(userId);
    if (!user) {
      throw { statusCode: 404, message: 'User not found', code: 'USER_NOT_FOUND' };
    }
    return {
      id: user.id,
      email: user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      roles: user.roles,
      isActive: user.is_active,
      lastLoginAt: user.last_login_at,
      createdAt: user.created_at,
    };
  }
}
