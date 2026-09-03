import React, { useState, useRef, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client.js';
import { logout } from '../../store/slices/authSlice.js';
import {
  setGlobalSearchOpen,
  setHealthModalOpen,
  toggleMobileMenu,
  toggleSidebar,
} from '../../store/slices/uiSlice.js';
import {
  markAllAsRead,
  markAsRead,
  addToast,
} from '../../store/slices/notificationSlice.js';
import {
  Scale,
  Search,
  Activity,
  Bell,
  User,
  LogOut,
  ChevronDown,
  Menu,
  CheckCheck,
  ExternalLink,
  Shield,
  Sliders,
} from 'lucide-react';
import { Badge } from '../common/Badge.jsx';
import { usePermissions } from '../../utils/usePermissions.js';
import { PERMISSIONS } from '../../constants/permissions.js';

export const TopHeader = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, role, isSuperAdmin, hasPermission } = usePermissions();
  const notifications = useSelector((state) => state.notifications.notifications);
  const unreadCount = notifications.filter((n) => !n.read).length;

  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);

  const profileRef = useRef(null);
  const notifRef = useRef(null);

  // Poll system health every 30 seconds for header indicator
  const { data: healthData } = useQuery({
    queryKey: ['systemHealthHeader'],
    queryFn: async () => {
      const res = await apiClient.get('/health');
      return res.data;
    },
    refetchInterval: 30000,
    staleTime: 20000,
  });

  // Close menus on click outside
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (profileRef.current && !profileRef.current.contains(e.target)) {
        setProfileMenuOpen(false);
      }
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setNotificationsOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleLogout = async () => {
    try {
      await apiClient.post('/api/auth/logout');
    } catch (e) {
      // Proceed even if network fails
    }
    dispatch(logout());
    dispatch(
      addToast({
        type: 'info',
        title: 'Logged Out',
        message: 'You have been safely signed out.',
      })
    );
    navigate('/auth/login');
  };

  const isHealthy = healthData?.status === 'UP';

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between h-16 px-4 sm:px-6 bg-white border-b border-slate-200/80 shadow-subtle">
      {/* Left section: Mobile toggle + App Branding */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => dispatch(toggleMobileMenu())}
          className="lg:hidden p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg"
          aria-label="Toggle mobile menu"
        >
          <Menu className="w-5 h-5" />
        </button>

        <div className="flex items-center gap-2.5">
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-900 to-blue-600 text-white flex items-center justify-center shadow-sm">
            <Scale className="w-5 h-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="font-extrabold text-slate-900 text-base tracking-tight">
                Nyaya<span className="text-blue-600">Data</span>
              </span>
            </div>
            <p className="hidden md:block text-[10px] text-slate-400 font-medium -mt-0.5 tracking-tight">
              Indian Court Data Ingestion & Intelligence Platform
            </p>
          </div>
        </div>
      </div>

      {/* Center: Global Search Bar Placeholder */}
      <div className="hidden md:flex flex-1 max-w-md mx-6">
        <button
          onClick={() => dispatch(setGlobalSearchOpen(true))}
          className="w-full flex items-center justify-between px-3.5 py-2 text-xs bg-slate-50 hover:bg-slate-100/80 border border-slate-200/90 rounded-xl text-slate-400 hover:text-slate-600 transition-all shadow-2xs group"
        >
          <div className="flex items-center gap-2.5">
            <Search className="w-4 h-4 text-slate-400 group-hover:text-blue-600 transition-colors" />
            <span className="text-slate-500">Search courts, cases, CNR numbers, or modules...</span>
          </div>
          <kbd className="px-1.5 py-0.5 text-[10px] font-mono bg-white border border-slate-200 rounded text-slate-400 shadow-2xs">
            Ctrl K
          </kbd>
        </button>
      </div>

      {/* Right: API Health Indicator, Notifications & User Profile */}
      <div className="flex items-center gap-2 sm:gap-3">
        {/* API Health Indicator Badge (Clickable to open Telemetry modal) */}
        <button
          onClick={() => dispatch(setHealthModalOpen(true))}
          className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-slate-100 transition-colors text-xs font-medium text-slate-700"
          title="Click to view full system health inspector"
        >
          <span className={`w-2 h-2 rounded-full ${isHealthy ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500 animate-pulse'}`} />
          <span className="hidden sm:inline">API:</span>
          <span className="font-semibold text-slate-900">{isHealthy ? 'Healthy' : 'Standby'}</span>
        </button>

        {/* Notifications Dropdown */}
        <div className="relative" ref={notifRef}>
          <button
            onClick={() => setNotificationsOpen(!notificationsOpen)}
            className="relative p-2 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-lg transition-colors"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5" />
            {unreadCount > 0 && (
              <span className="absolute top-1 right-1 w-4 h-4 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center animate-bounce">
                {unreadCount}
              </span>
            )}
          </button>

          {notificationsOpen && (
            <div className="absolute right-0 mt-2 w-80 sm:w-96 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-fadeIn">
              <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/70">
                <div className="flex items-center gap-2">
                  <h4 className="font-bold text-xs uppercase tracking-wider text-slate-900">
                    Notifications
                  </h4>
                  {unreadCount > 0 && <Badge variant="danger" size="sm">{unreadCount} new</Badge>}
                </div>
                {unreadCount > 0 && (
                  <button
                    onClick={() => dispatch(markAllAsRead())}
                    className="text-[11px] text-blue-600 hover:underline flex items-center gap-1 font-medium"
                  >
                    <CheckCheck className="w-3.5 h-3.5" /> Mark all read
                  </button>
                )}
              </div>

              <div className="max-h-72 overflow-y-auto divide-y divide-slate-100">
                {notifications.length === 0 ? (
                  <div className="p-6 text-center text-xs text-slate-500">
                    No new notifications.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <div
                      key={notif.id}
                      onClick={() => dispatch(markAsRead(notif.id))}
                      className={`p-3.5 text-xs hover:bg-slate-50 transition-colors cursor-pointer ${
                        !notif.read ? 'bg-blue-50/40' : ''
                      }`}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="font-semibold text-slate-900">{notif.title}</div>
                        <span className="text-[10px] text-slate-400 shrink-0">
                          {new Date(notif.timestamp).toLocaleTimeString([], {
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </span>
                      </div>
                      <p className="text-slate-600 text-[11px] mt-1 leading-relaxed">
                        {notif.message}
                      </p>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>

        {/* User Profile Menu */}
        <div className="relative" ref={profileRef}>
          <button
            onClick={() => setProfileMenuOpen(!profileMenuOpen)}
            className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors focus:outline-none"
          >
            <div className="w-8 h-8 rounded-lg bg-blue-700 text-white font-bold text-xs flex items-center justify-center shadow-2xs">
              {user?.firstName?.[0] || 'U'}{user?.lastName?.[0] || 'A'}
            </div>
            <div className="hidden lg:block text-left">
              <div className="text-xs font-bold text-slate-900 leading-tight">
                {user?.firstName} {user?.lastName}
              </div>
              <div className="text-[10px] text-slate-500 font-mono font-bold">{role}</div>
            </div>
            <ChevronDown className="w-3.5 h-3.5 text-slate-400 hidden lg:block" />
          </button>

          {profileMenuOpen && (
            <div className="absolute right-0 mt-2 w-64 bg-white rounded-2xl border border-slate-200 shadow-xl z-50 overflow-hidden animate-fadeIn divide-y divide-slate-100">
              <div className="p-4 bg-slate-50/60">
                <div className="text-xs font-bold text-slate-900">
                  {user?.name || `${user?.firstName || ''} ${user?.lastName || ''}`.trim() || 'User'}
                </div>
                <div className="text-[11px] text-slate-500 truncate">{user?.email}</div>
                <div className="mt-2 flex items-center gap-1.5">
                  <Badge
                    variant={isSuperAdmin ? 'purple' : role === 'DATA_ADMIN' ? 'navy' : 'default'}
                    size="sm"
                  >
                    {role}
                  </Badge>
                </div>
              </div>

              <div className="p-1.5 space-y-0.5">
                {hasPermission(PERMISSIONS.VIEW_SETTINGS) && (
                  <button
                    onClick={() => {
                      setProfileMenuOpen(false);
                      navigate('/settings');
                    }}
                    className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                  >
                    <Sliders className="w-4 h-4 text-slate-500" />
                    System Settings
                  </button>
                )}
                <button
                  onClick={() => {
                    setProfileMenuOpen(false);
                    dispatch(setHealthModalOpen(true));
                  }}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
                >
                  <Activity className="w-4 h-4 text-slate-500" />
                  Health & Queues
                </button>
              </div>

              <div className="p-1.5">
                <button
                  onClick={handleLogout}
                  className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-medium text-rose-600 hover:bg-rose-50 rounded-lg transition-colors"
                >
                  <LogOut className="w-4 h-4 text-rose-500" />
                  Sign Out
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </header>
  );
};
