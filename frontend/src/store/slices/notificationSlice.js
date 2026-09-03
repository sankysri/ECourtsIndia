import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  notifications: [
    {
      id: 'notif-1',
      title: 'Platform Foundation Initialized',
      message: 'Platform architecture & UI shell initialized successfully.',
      type: 'info',
      read: false,
      timestamp: new Date().toISOString(),
    },
  ],
  toasts: [],
};

const notificationSlice = createSlice({
  name: 'notifications',
  initialState,
  reducers: {
    addNotification: (state, action) => {
      const notif = {
        id: `notif-${Date.now()}`,
        read: false,
        timestamp: new Date().toISOString(),
        ...action.payload,
      };
      state.notifications.unshift(notif);
    },
    markAllAsRead: (state) => {
      state.notifications.forEach((n) => {
        n.read = true;
      });
    },
    markAsRead: (state, action) => {
      const notif = state.notifications.find((n) => n.id === action.payload);
      if (notif) notif.read = true;
    },
    clearNotifications: (state) => {
      state.notifications = [];
    },
    addToast: (state, action) => {
      const toast = {
        id: `toast-${Date.now()}`,
        type: 'info', // 'success' | 'error' | 'warning' | 'info'
        duration: 4000,
        ...action.payload,
      };
      state.toasts.push(toast);
    },
    removeToast: (state, action) => {
      state.toasts = state.toasts.filter((t) => t.id !== action.payload);
    },
  },
});

export const {
  addNotification,
  markAllAsRead,
  markAsRead,
  clearNotifications,
  addToast,
  removeToast,
} = notificationSlice.actions;

export default notificationSlice.reducer;
