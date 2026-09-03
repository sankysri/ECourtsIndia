import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AppLayout } from '../components/layout/AppLayout.jsx';
import { ProtectedRoute } from './ProtectedRoute.jsx';
import { PermissionRoute } from './PermissionRoute.jsx';
import { PERMISSIONS } from '../constants/permissions.js';

// Pages
import { LoginPage } from '../features/auth/LoginPage.jsx';
import { DashboardPage } from '../features/dashboard/DashboardPage.jsx';
import { CourtsPage } from '../features/courts/CourtsPage.jsx';
import { CourtDetailPage } from '../features/courts/CourtDetailPage.jsx';
import { CasesPage } from '../features/cases/CasesPage.jsx';
import { CaseDetailPage } from '../features/cases/CaseDetailPage.jsx';
import { DiscoveryPage } from '../features/discovery/DiscoveryPage.jsx';
import { SyncCenterPage } from '../features/sync/SyncCenterPage.jsx';
import { DocumentsPage } from '../features/documents/DocumentsPage.jsx';
import { SearchPage } from '../features/search/SearchPage.jsx';
import { ApiUsagePage } from '../features/apiUsage/ApiUsagePage.jsx';
import { FailuresPage } from '../features/failures/FailuresPage.jsx';
import { SettingsPage } from '../features/settings/SettingsPage.jsx';

export const AppRoutes = () => {
  return (
    <Routes>
      {/* Public Routes */}
      <Route path="/auth/login" element={<LoginPage />} />

      {/* Protected Application Shell */}
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <AppLayout />
          </ProtectedRoute>
        }
      >
        <Route
          index
          element={
            <PermissionRoute permission={PERMISSIONS.VIEW_DASHBOARD}>
              <DashboardPage />
            </PermissionRoute>
          }
        />
        <Route
          path="courts"
          element={
            <PermissionRoute permission={PERMISSIONS.VIEW_COURTS}>
              <CourtsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="courts/:courtId"
          element={
            <PermissionRoute permission={PERMISSIONS.VIEW_COURTS}>
              <CourtDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="cases"
          element={
            <PermissionRoute permission={PERMISSIONS.VIEW_CASES}>
              <CasesPage />
            </PermissionRoute>
          }
        />
        <Route
          path="cases/:cnr"
          element={
            <PermissionRoute permission={PERMISSIONS.VIEW_CASES}>
              <CaseDetailPage />
            </PermissionRoute>
          }
        />
        <Route
          path="discovery"
          element={
            <PermissionRoute permission={PERMISSIONS.VIEW_DISCOVERY}>
              <DiscoveryPage />
            </PermissionRoute>
          }
        />
        <Route
          path="sync"
          element={
            <PermissionRoute permission={PERMISSIONS.VIEW_SYNC}>
              <SyncCenterPage />
            </PermissionRoute>
          }
        />
        <Route
          path="documents"
          element={
            <PermissionRoute permission={PERMISSIONS.VIEW_DOCUMENTS}>
              <DocumentsPage />
            </PermissionRoute>
          }
        />
        <Route
          path="search"
          element={
            <PermissionRoute permission={PERMISSIONS.VIEW_SEARCH}>
              <SearchPage />
            </PermissionRoute>
          }
        />
        <Route
          path="api-usage"
          element={
            <PermissionRoute permission={PERMISSIONS.VIEW_API_USAGE}>
              <ApiUsagePage />
            </PermissionRoute>
          }
        />
        <Route
          path="failures"
          element={
            <PermissionRoute permission={PERMISSIONS.VIEW_FAILURES}>
              <FailuresPage />
            </PermissionRoute>
          }
        />
        <Route
          path="settings"
          element={
            <PermissionRoute permission={PERMISSIONS.VIEW_SETTINGS}>
              <SettingsPage />
            </PermissionRoute>
          }
        />
      </Route>

      {/* Catch-all fallback */}
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};
