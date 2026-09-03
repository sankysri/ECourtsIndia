import { useSelector } from 'react-redux';
import { ROLES } from '../constants/roles.js';
import { PERMISSIONS } from '../constants/permissions.js';
import { hasPermission as checkPermission, getPermissionsForRoles } from '../constants/rolePermissions.js';

export const usePermissions = () => {
  const user = useSelector((state) => state.auth.user);
  const roles = user?.roles && user.roles.length ? user.roles : user?.role ? [user.role] : [ROLES.READ_ONLY];
  const permissions = user?.permissions && user.permissions.length ? user.permissions : getPermissionsForRoles(roles);

  const isSuperAdmin = roles.includes(ROLES.SUPER_ADMIN);
  const isDataAdmin = roles.includes(ROLES.DATA_ADMIN);
  const isReadOnly = !isSuperAdmin && !isDataAdmin;

  const hasPermission = (permission) => {
    if (isSuperAdmin) return true;
    if (!permission) return true;
    return checkPermission(roles, permission) || permissions.includes(permission);
  };

  const hasAnyPermission = (permList = []) => {
    if (isSuperAdmin) return true;
    if (!permList.length) return true;
    return permList.some((p) => hasPermission(p));
  };

  return {
    user,
    roles,
    role: roles[0] || ROLES.READ_ONLY,
    permissions,
    isSuperAdmin,
    isDataAdmin,
    isReadOnly,
    hasPermission,
    hasAnyPermission,
  };
};
