import React from 'react';
import { StatsCard } from './StatsCard.jsx';
import { QueueStatusWidget } from './QueueStatusWidget.jsx';
import { BackfillProgressWidget } from './BackfillProgressWidget.jsx';
import { RecentActivityWidget } from './RecentActivityWidget.jsx';
import { SkeletonCard } from '../../../components/common/Skeleton.jsx';
import {
  Scale,
  Compass,
  RefreshCw,
  PlusCircle,
  Activity,
  AlertTriangle,
} from 'lucide-react';

export const DataAdminDashboard = ({ summary, summaryLoading, healthData, healthLoading, auditData }) => {
  const totalCases = summary?.totalCases || 0;
  const activeJobs = summary?.activeDiscoveryJobs || 0;
  const totalCampaigns = summary?.totalCampaigns || 0;
  const newToday = summary?.newCasesToday || 0;
  const updatedToday = summary?.updatedCasesToday || 0;
  const failedJobs = summary?.failedJobs || 0;

  const stats = [
    {
      title: 'Total Ingested Cases',
      value: totalCases.toLocaleString(),
      subvalue: 'Registered CNR index',
      icon: Scale,
      iconBg: 'bg-indigo-50 text-indigo-600',
      badgeText: 'CNR Registry',
      badgeVariant: 'navy',
    },
    {
      title: 'Active Discovery Jobs',
      value: activeJobs,
      subvalue: 'Running crawlers in BullMQ',
      icon: Compass,
      iconBg: 'bg-blue-50 text-blue-600',
      badgeText: activeJobs > 0 ? `${activeJobs} Active` : 'Idle',
      badgeVariant: activeJobs > 0 ? 'info' : 'default',
    },
    {
      title: 'Backfill Campaigns',
      value: totalCampaigns,
      subvalue: 'Historical ingestion batches',
      icon: RefreshCw,
      iconBg: 'bg-purple-50 text-purple-600',
      badgeText: 'Sync Engine',
      badgeVariant: 'purple',
    },
    {
      title: 'New Cases Discovered Today',
      value: `+${newToday.toLocaleString()}`,
      subvalue: 'Automated daily filings',
      icon: PlusCircle,
      iconBg: 'bg-emerald-50 text-emerald-600',
      badgeText: 'Live Stream',
      badgeVariant: 'success',
    },
    {
      title: 'Updated Cases Today',
      value: updatedToday.toLocaleString(),
      subvalue: 'Proceedings & hearings',
      icon: Activity,
      iconBg: 'bg-amber-50 text-amber-600',
      badgeText: 'Synchronized',
      badgeVariant: 'warning',
    },
    {
      title: 'Failed Ingestion Jobs',
      value: failedJobs,
      subvalue: 'Dead letter queue monitor',
      icon: AlertTriangle,
      iconBg: 'bg-rose-50 text-rose-600',
      badgeText: failedJobs === 0 ? '0 Errors' : `${failedJobs} Failed`,
      badgeVariant: failedJobs === 0 ? 'success' : 'error',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 6 Operational Stats Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {summaryLoading
          ? Array.from({ length: 6 }).map((_, i) => <SkeletonCard key={i} />)
          : stats.map((stat) => <StatsCard key={stat.title} {...stat} />)}
      </div>

      {/* Operational Telemetry Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <QueueStatusWidget queuesData={healthData?.services?.queues} isLoading={healthLoading} />
        </div>

        <div className="space-y-6">
          <BackfillProgressWidget />
          <RecentActivityWidget auditLogs={auditData} />
        </div>
      </div>
    </div>
  );
};
