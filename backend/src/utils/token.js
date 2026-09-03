import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

export const generateTokens = (user) => {
  const payload = {
    userId: user.id,
    email: user.email,
    roles: user.roles || [],
    permissions: user.permissions || [],
  };

  const accessToken = jwt.sign(payload, env.JWT_SECRET, {
    expiresIn: env.JWT_EXPIRES_IN,
  });

  const refreshToken = jwt.sign(
    { userId: user.id, type: 'refresh' },
    env.JWT_REFRESH_SECRET,
    { expiresIn: env.JWT_REFRESH_EXPIRES_IN }
  );

  return { accessToken, refreshToken };
};

export const verifyAccessToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};

export const verifyRefreshToken = (token) => {
  return jwt.verify(token, env.JWT_REFRESH_SECRET);
};
