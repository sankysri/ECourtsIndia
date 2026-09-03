import { createSlice } from '@reduxjs/toolkit';

// Restore auth state from localStorage safely
const getStoredUser = () => {
  try {
    const raw = localStorage.getItem('nyaya_user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
};

const initialState = {
  user: getStoredUser(),
  accessToken: localStorage.getItem('nyaya_access_token') || null,
  refreshToken: localStorage.getItem('nyaya_refresh_token') || null,
  isAuthenticated: Boolean(localStorage.getItem('nyaya_access_token')),
  loading: false,
  error: null,
};

const authSlice = createSlice({
  name: 'auth',
  initialState,
  reducers: {
    setAuthLoading: (state, action) => {
      state.loading = action.payload;
    },
    setAuthSuccess: (state, action) => {
      const { user, tokens } = action.payload;
      state.user = user;
      state.accessToken = tokens.accessToken;
      state.refreshToken = tokens.refreshToken;
      state.isAuthenticated = true;
      state.loading = false;
      state.error = null;

      localStorage.setItem('nyaya_user', JSON.stringify(user));
      localStorage.setItem('nyaya_access_token', tokens.accessToken);
      localStorage.setItem('nyaya_refresh_token', tokens.refreshToken);
    },
    setAuthError: (state, action) => {
      state.error = action.payload;
      state.loading = false;
    },
    clearAuthError: (state) => {
      state.error = null;
    },
    logout: (state) => {
      state.user = null;
      state.accessToken = null;
      state.refreshToken = null;
      state.isAuthenticated = false;
      state.loading = false;
      state.error = null;

      localStorage.removeItem('nyaya_user');
      localStorage.removeItem('nyaya_access_token');
      localStorage.removeItem('nyaya_refresh_token');
    },
    updateUser: (state, action) => {
      state.user = { ...state.user, ...action.payload };
      localStorage.setItem('nyaya_user', JSON.stringify(state.user));
    },
  },
});

export const { setAuthLoading, setAuthSuccess, setAuthError, clearAuthError, logout, updateUser } =
  authSlice.actions;

export default authSlice.reducer;
