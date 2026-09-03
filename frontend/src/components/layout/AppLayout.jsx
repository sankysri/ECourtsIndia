import React from 'react';
import { Outlet } from 'react-router-dom';
import { TopHeader } from './TopHeader.jsx';
import { Sidebar } from './Sidebar.jsx';
import { ContextPanel } from './ContextPanel.jsx';
import { ErrorBoundary } from '../common/ErrorBoundary.jsx';
import { ToastContainer } from '../common/ToastContainer.jsx';
import { HealthStatusModal } from '../common/HealthStatusModal.jsx';
import { GlobalSearchModal } from '../common/GlobalSearchModal.jsx';

export const AppLayout = () => {
  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Collapsible / Responsive Sidebar */}
      <Sidebar />

      {/* Main Content Viewport */}
      <div className="flex flex-col flex-1 min-w-0 overflow-hidden">
        {/* Sticky Top Header */}
        <TopHeader />

        {/* Scrollable Page Body */}
        <main className="flex-1 overflow-y-auto p-4 sm:p-6 lg:p-8">
          <div className="max-w-7xl mx-auto w-full">
            <ErrorBoundary>
              <Outlet />
            </ErrorBoundary>
          </div>
        </main>
      </div>

      {/* Slide-over Context Panel */}
      <ContextPanel />

      {/* Interactive Modals & Toast notifications */}
      <HealthStatusModal />
      <GlobalSearchModal />
      <ToastContainer />
    </div>
  );
};
