import bcrypt from 'bcryptjs';
import { db } from '../../database/datastore.js';
import { generateTokens, verifyRefreshToken } from '../../utils/token.js';
import { logAuditEvent } from '../../middleware/audit.js';
import { getPermissionsForRoles } from '../../constants/rolePermissions.js';
import { ROLES } from '../../constants/roles.js';

export class AuthService {
  static async login({ email, password, req }) {
    const user = await db.findUserByEmail(email);
    if (!user) {
      throw { statusCode: 401, message: 'Invalid email or password credentials', code: 'INVALID_CREDENTIALS' };
    }

    if (!user.is_active) {
      throw { statusCode: 403, message: 'Account is deactivated. Contact an administrator.', code: 'ACCOUNT_DEACTIVATED' };
    }

    const isMatch = await bcrypt.compare(password, user.password_hash);
    if (!isMatch) {
      throw { statusCode: 401, message: 'Invalid email or password credentials', code: 'INVALID_CREDENTIALS' };
    }

    const { accessToken, refreshToken } = generateTokens(user);

    await db.updateUserLogin(user.id);
    await db.updateUserRefreshToken(user.id, refreshToken);

    await logAuditEvent({
      userId: user.id,
      action: 'USER_LOGIN',
      entity: 'AUTH',
      entityId: user.id,
      details: { email: user.email },
      req,
    });

    const roles = user.roles && user.roles.length ? user.roles : [ROLES.READ_ONLY];
    const permissions = getPermissionsForRoles(roles);

    return {
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: roles[0] || ROLES.READ_ONLY,
        roles,
        permissions,
        lastLoginAt: user.last_login_at,
      },
      tokens: {
        accessToken,
        refreshToken,
      },
    };
  }

  static async refreshToken({ refreshToken }) {
    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      throw { statusCode: 401, message: 'Refresh token is invalid or expired', code: 'INVALID_REFRESH_TOKEN' };
    }

    const user = await db.findUserById(decoded.userId);
    if (!user || !user.is_active) {
      throw { statusCode: 401, message: 'User associated with refresh token not found', code: 'USER_NOT_FOUND' };
    }

    const tokens = generateTokens(user);
    await db.updateUserRefreshToken(user.id, tokens.refreshToken);

    const roles = user.roles && user.roles.length ? user.roles : [ROLES.READ_ONLY];
    const permissions = getPermissionsForRoles(roles);

    return {
      tokens,
      user: {
        id: user.id,
        email: user.email,
        name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
        firstName: user.first_name,
        lastName: user.last_name,
        role: roles[0] || ROLES.READ_ONLY,
        roles,
        permissions,
      },
    };
  }

  static async logout({ userId, req }) {
    if (userId) {
      await db.updateUserRefreshToken(userId, null);
      await logAuditEvent({
        userId,
        action: 'USER_LOGOUT',
        entity: 'AUTH',
        entityId: userId,
        req,
      });
    }
    return { success: true };
  }

  static async seedUser({ email, password, firstName, lastName, roles }) {
    const existing = await db.findUserByEmail(email);
    if (existing) {
      throw { statusCode: 409, message: 'User with this email already exists', code: 'USER_EXISTS' };
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const userRoles = roles && roles.length ? roles : [ROLES.READ_ONLY];
    const newUser = await db.createUser(
      {
        email,
        password_hash: passwordHash,
        first_name: firstName,
        last_name: lastName,
        is_active: true,
      },
      userRoles
    );

    return {
      id: newUser.id,
      email: newUser.email,
      name: `${newUser.first_name || ''} ${newUser.last_name || ''}`.trim() || newUser.email,
      firstName: newUser.first_name,
      lastName: newUser.last_name,
      role: userRoles[0],
      roles: userRoles,
      permissions: getPermissionsForRoles(userRoles),
    };
  }
}
