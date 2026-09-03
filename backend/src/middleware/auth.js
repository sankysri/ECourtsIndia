import { verifyAccessToken } from '../utils/token.js';
import { errorResponse } from '../utils/apiResponse.js';
import { db } from '../database/datastore.js';
import { getPermissionsForRoles } from '../constants/rolePermissions.js';
import { ROLES } from '../constants/roles.js';

export const requireAuth = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return errorResponse(res, 'Authorization token required', 'UNAUTHORIZED', [], 401);
    }

    const token = authHeader.split(' ')[1];
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return errorResponse(res, 'Access token expired', 'TOKEN_EXPIRED', [], 401);
      }
      return errorResponse(res, 'Invalid access token', 'UNAUTHORIZED', [], 401);
    }

    const user = await db.findUserById(decoded.userId);
    if (!user || !user.is_active) {
      return errorResponse(res, 'User account is deactivated or does not exist', 'UNAUTHORIZED', [], 401);
    }

    const roles = user.roles && user.roles.length ? user.roles : [ROLES.READ_ONLY];
    const permissions = getPermissionsForRoles(roles);

    req.user = {
      id: user.id,
      email: user.email,
      name: `${user.first_name || ''} ${user.last_name || ''}`.trim() || user.email,
      firstName: user.first_name,
      lastName: user.last_name,
      role: roles[0] || ROLES.READ_ONLY,
      roles,
      permissions,
    };

    next();
  } catch (err) {
    next(err);
  }
};
