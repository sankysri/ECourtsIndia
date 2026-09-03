import React from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useSelector } from 'react-redux';

export const ProtectedRoute = ({ children, requiredRole }) => {
  const location = useLocation();
  const { isAuthenticated, user } = useSelector((state) => state.auth);

  if (!isAuthenticated) {
    return <Navigate to="/auth/login" state={{ from: location }} replace />;
  }

  if (requiredRole && !user?.roles?.includes('SUPER_ADMIN') && !user?.roles?.includes(requiredRole)) {
    return <Navigate to="/" replace />;
  }

  return children;
};
