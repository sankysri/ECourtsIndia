import React from 'react';
import { usePermissions } from '../../utils/usePermissions.js';

export const PermissionGuard = ({ permission, permissions = [], fallback = null, children }) => {
  const { hasPermission, hasAnyPermission } = usePermissions();

  if (permission && !hasPermission(permission)) {
    return fallback;
  }

  if (permissions.length > 0 && !hasAnyPermission(permissions)) {
    return fallback;
  }

  return <>{children}</>;
};
