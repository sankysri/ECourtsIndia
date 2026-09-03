import { errorResponse } from '../utils/apiResponse.js';
import { ROLES } from '../constants/roles.js';
import { hasPermission } from '../constants/rolePermissions.js';

/**
 * Enforce role-based access
 */
export const requireRole = (allowedRoles = []) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 'UNAUTHORIZED', [], 401);
    }

    const userRoles = req.user.roles || [];
    // SUPER_ADMIN has access to all roles
    if (userRoles.includes(ROLES.SUPER_ADMIN)) {
      return next();
    }

    const hasAllowedRole = allowedRoles.some((role) => userRoles.includes(role));
    if (!hasAllowedRole) {
      return errorResponse(
        res,
        'You do not have permission to perform this action',
        'FORBIDDEN',
        [`Required one of: ${allowedRoles.join(', ')}`],
        403
      );
    }

    next();
  };
};

/**
 * Enforce permission-based access (Single permission or array of acceptable permissions)
 */
export const requirePermission = (requiredPermission) => {
  return (req, res, next) => {
    if (!req.user) {
      return errorResponse(res, 'Authentication required', 'UNAUTHORIZED', [], 401);
    }

    const userRoles = req.user.roles || [];
    if (userRoles.includes(ROLES.SUPER_ADMIN)) {
      return next();
    }

    const perms = Array.isArray(requiredPermission) ? requiredPermission : [requiredPermission];
    const userHasPerm = perms.some((p) => hasPermission(userRoles, p));

    if (!userHasPerm) {
      return errorResponse(
        res,
        'You do not have permission to perform this action',
        'FORBIDDEN',
        [`Required permission: ${perms.join(' OR ')}`],
        403
      );
    }

    next();
  };
};

export const requireSuperAdmin = requireRole([ROLES.SUPER_ADMIN]);
export const requireDataAdmin = requireRole([ROLES.SUPER_ADMIN, ROLES.DATA_ADMIN]);
