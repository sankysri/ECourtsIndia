import React from 'react';
import { StatsCard } from './StatsCard.jsx';
import { SystemHealthWidget } from './SystemHealthWidget.jsx';
import { QueueStatusWidget } from './QueueStatusWidget.jsx';
import { BackfillProgressWidget } from './BackfillProgressWidget.jsx';
import { RecentActivityWidget } from './RecentActivityWidget.jsx';
import { ApiUsageSummaryWidget } from './ApiUsageSummaryWidget.jsx';
import { SkeletonCard } from '../../../components/common/Skeleton.jsx';
import {
  Building2,
  Scale,
  Activity,
  CheckCircle2,
  PlusCircle,
  RefreshCw,
  FileText,
  AlertTriangle,
} from 'lucide-react';

export const SuperAdminDashboard = ({ summary, summaryLoading, healthData, healthLoading, auditData }) => {
  const totalCourts = summary?.totalCourts || 0;
  const totalCases = summary?.totalCases || 0;
  const activeCases = summary?.activeCases || 0;
  const disposedCases = summary?.disposedCases || 0;
  const newToday = summary?.newCasesToday || 0;
  const updatedToday = summary?.updatedCasesToday || 0;
  const documents = summary?.documents || 0;
  const failedJobs = summary?.failedJobs || 0;

  const stats = [
    {
      title: 'Total Courts',
      value: totalCourts.toLocaleString(),
      subvalue: 'District & High Court complexes',
      icon: Building2,
      iconBg: 'bg-blue-50 text-blue-600',
      badgeText: `${totalCourts} Indexed`,
      badgeVariant: 'info',
    },
    {
      title: 'Total Ingested Cases',
      value: totalCases.toLocaleString(),
      subvalue: 'Verified CNR Registry records',
      icon: Scale,
      iconBg: 'bg-indigo-50 text-indigo-600',
      badgeText: 'CNR Registry',
      badgeVariant: 'navy',
    },
    {
      title: 'Active Cases',
      value: activeCases.toLocaleString(),
      subvalue: 'Pending judicial proceedings',
      icon: Activity,
      iconBg: 'bg-amber-50 text-amber-600',
      badgeText: `${activeCases} Active`,
      badgeVariant: 'warning',
    },
    {
      title: 'Disposed Cases',
      value: disposedCases.toLocaleString(),
      subvalue: 'Decided judgments & orders',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 text-emerald-600',
      badgeText: `${disposedCases} Disposed`,
      badgeVariant: 'success',
    },
    {
      title: 'New Cases Today',
      value: `+${newToday.toLocaleString()}`,
      subvalue: 'Daily scraped filings',
      icon: PlusCircle,
      iconBg: 'bg-cyan-50 text-cyan-600',
      badgeText: 'Live Ingestion',
      badgeVariant: 'default',
    },
    {
      title: 'Updated Cases Today',
      value: updatedToday.toLocaleString(),
      subvalue: 'Daily hearing updates',
      icon: RefreshCw,
      iconBg: 'bg-purple-50 text-purple-600',
      badgeText: 'Daily Sync',
      badgeVariant: 'default',
    },
    {
      title: 'Documents',
      value: documents.toLocaleString(),
      subvalue: 'Judgment PDFs & orders (S3)',
      icon: FileText,
      iconBg: 'bg-teal-50 text-teal-600',
      badgeText: 'S3 Storage',
      badgeVariant: 'navy',
    },
    {
      title: 'Failed Jobs',
      value: failedJobs,
      subvalue: 'Dead letter queue monitor',
      icon: AlertTriangle,
      iconBg: 'bg-rose-50 text-rose-600',
      badgeText: failedJobs === 0 ? '0 Failures' : `${failedJobs} Errors`,
      badgeVariant: failedJobs === 0 ? 'success' : 'error',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 8 Stats Cards Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading
          ? Array.from({ length: 8 }).map((_, i) => <SkeletonCard key={i} />)
          : stats.map((stat) => <StatsCard key={stat.title} {...stat} />)}
      </div>

      {/* Primary Telemetry & Health Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <SystemHealthWidget healthData={healthData} isLoading={healthLoading} />
          <QueueStatusWidget queuesData={healthData?.services?.queues} isLoading={healthLoading} />
        </div>

        <div className="space-y-6">
          <ApiUsageSummaryWidget />
          <BackfillProgressWidget />
          <RecentActivityWidget auditLogs={auditData} />
        </div>
      </div>
    </div>
  );
};
