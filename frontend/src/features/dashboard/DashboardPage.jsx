import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client.js';
import { SuperAdminDashboard } from './components/SuperAdminDashboard.jsx';
import { DataAdminDashboard } from './components/DataAdminDashboard.jsx';
import { ReadOnlyDashboard } from './components/ReadOnlyDashboard.jsx';
import { usePermissions } from '../../utils/usePermissions.js';
import { Button } from '../../components/common/Button.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { RefreshCw } from 'lucide-react';

export const DashboardPage = () => {
  const { isSuperAdmin, isDataAdmin, isReadOnly, role } = usePermissions();

  // Query 1: Real Calculated Summary (/api/dashboard/summary)
  const {
    data: summaryData,
    isLoading: summaryLoading,
    refetch: refetchSummary,
    isFetching: summaryFetching,
  } = useQuery({
    queryKey: ['dashboardSummary'],
    queryFn: async () => {
      const res = await apiClient.get('/api/dashboard/summary');
      return res.data;
    },
    refetchInterval: 10000,
  });

  // Query 2: System Health & Queue status (/api/dashboard/system-health)
  const {
    data: healthData,
    isLoading: healthLoading,
    refetch: refetchHealth,
    isFetching: healthFetching,
  } = useQuery({
    queryKey: ['dashboardSystemHealth'],
    queryFn: async () => {
      const res = await apiClient.get('/api/dashboard/system-health');
      return res.data;
    },
    refetchInterval: 15000,
    enabled: !isReadOnly,
  });

  // Query 3: Recent Activity (/api/dashboard/recent-activity)
  const { data: activityData, refetch: refetchActivity } = useQuery({
    queryKey: ['dashboardRecentActivity'],
    queryFn: async () => {
      const res = await apiClient.get('/api/dashboard/recent-activity?limit=10');
      return res.data.activity || [];
    },
    refetchInterval: 10000,
    enabled: !isReadOnly,
  });

  const handleRefreshAll = () => {
    refetchSummary();
    if (!isReadOnly) {
      refetchHealth();
      refetchActivity();
    }
  };

  const getRoleBadgeVariant = () => {
    if (isSuperAdmin) return 'purple';
    if (isDataAdmin) return 'navy';
    return 'default';
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Badge variant={getRoleBadgeVariant()} size="sm">
              Role: {role}
            </Badge>
          </div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            {isReadOnly
              ? 'Court Data & Case Intelligence Directory'
              : isDataAdmin
              ? 'Data Operations & Ingestion Console'
              : 'Ingestion Architecture & System Overview'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
            {isReadOnly
              ? 'Explore national court structures, case dossiers, proceedings, and judicial filings'
              : isDataAdmin
              ? 'Monitor case discovery jobs, backfill pipelines, daily scrapers, and queue throughput'
              : 'End-to-end telemetry for court ingestion pipelines, rate limiters, BullMQ workers, and system health'}
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRefreshAll}
            isLoading={summaryFetching || healthFetching}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh Telemetry
          </Button>
        </div>
      </div>

      {/* Role-Specific Dashboard Views */}
      {isReadOnly ? (
        <ReadOnlyDashboard summary={summaryData} summaryLoading={summaryLoading} />
      ) : isDataAdmin ? (
        <DataAdminDashboard
          summary={summaryData}
          summaryLoading={summaryLoading}
          healthData={healthData}
          healthLoading={healthLoading}
          auditData={activityData || []}
        />
      ) : (
        <SuperAdminDashboard
          summary={summaryData}
          summaryLoading={summaryLoading}
          healthData={healthData}
          healthLoading={healthLoading}
          auditData={activityData || []}
        />
      )}
    </div>
  );
};
