import React from 'react';
import { usePermissions } from '../utils/usePermissions.js';
import { UnauthorizedPage } from '../components/common/UnauthorizedPage.jsx';

export const PermissionRoute = ({ permission, children }) => {
  const { hasPermission } = usePermissions();

  if (!permission) {
    return children;
  }

  const allowed = hasPermission(permission);
  if (!allowed) {
    return <UnauthorizedPage requiredPermission={permission} />;
  }

  return children;
};
