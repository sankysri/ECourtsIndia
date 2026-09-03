import { ROLES } from './roles.js';
import { PERMISSIONS } from './permissions.js';

export const ROLE_PERMISSIONS = {
  [ROLES.SUPER_ADMIN]: Object.values(PERMISSIONS),

  [ROLES.DATA_ADMIN]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_COURTS,
    PERMISSIONS.VIEW_CASES,
    PERMISSIONS.VIEW_DISCOVERY,
    PERMISSIONS.VIEW_SYNC,
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.VIEW_SEARCH,
    PERMISSIONS.VIEW_API_USAGE,
    PERMISSIONS.VIEW_FAILURES,

    PERMISSIONS.START_DISCOVERY,
    PERMISSIONS.PAUSE_DISCOVERY,
    PERMISSIONS.RESUME_DISCOVERY,
    PERMISSIONS.CANCEL_DISCOVERY,
    PERMISSIONS.RETRY_DISCOVERY,

    PERMISSIONS.START_SYNC,
    PERMISSIONS.RETRY_SYNC,
    PERMISSIONS.SYNC_COURTS,
    PERMISSIONS.SYNC_CASES,
  ],

  [ROLES.READ_ONLY]: [
    PERMISSIONS.VIEW_DASHBOARD,
    PERMISSIONS.VIEW_COURTS,
    PERMISSIONS.VIEW_CASES,
    PERMISSIONS.VIEW_DOCUMENTS,
    PERMISSIONS.VIEW_SEARCH,
  ],
};

/**
 * Get aggregated unique permissions for an array of roles
 */
export const getPermissionsForRoles = (roles = []) => {
  if (!roles || !roles.length) return ROLE_PERMISSIONS[ROLES.READ_ONLY];

  const permsSet = new Set();
  for (const role of roles) {
    const rolePerms = ROLE_PERMISSIONS[role] || [];
    for (const p of rolePerms) {
      permsSet.add(p);
    }
  }
  return Array.from(permsSet);
};

/**
 * Check if given roles have a specific permission
 */
export const hasPermission = (roles = [], permission) => {
  if (roles.includes(ROLES.SUPER_ADMIN)) return true;
  const userPerms = getPermissionsForRoles(roles);
  return userPerms.includes(permission);
};
