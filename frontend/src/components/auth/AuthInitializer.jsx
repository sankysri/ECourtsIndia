import React, { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { apiClient } from '../../api/client.js';
import { updateUser, logout } from '../../store/slices/authSlice.js';

export const AuthInitializer = ({ children }) => {
  const dispatch = useDispatch();
  const accessToken = useSelector((state) => state.auth.accessToken);

  useEffect(() => {
    if (!accessToken) return;

    let isMounted = true;
    apiClient
      .get('/api/auth/me')
      .then((res) => {
        if (isMounted && res.data?.data?.user) {
          dispatch(updateUser(res.data.data.user));
        }
      })
      .catch((err) => {
        if (err.response?.status === 401) {
          dispatch(logout());
        }
      });

    return () => {
      isMounted = false;
    };
  }, [accessToken, dispatch]);

  return <>{children}</>;
};
