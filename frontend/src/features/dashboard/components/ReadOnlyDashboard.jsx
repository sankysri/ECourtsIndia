import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/client.js';
import { StatsCard } from './StatsCard.jsx';
import { Card, CardHeader } from '../../../components/common/Card.jsx';
import { Badge } from '../../../components/common/Badge.jsx';
import { SkeletonCard } from '../../../components/common/Skeleton.jsx';
import {
  Building2,
  Scale,
  Activity,
  CheckCircle2,
  PlusCircle,
  Clock,
  Sparkles,
  Search,
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export const ReadOnlyDashboard = ({ summary, summaryLoading }) => {
  const navigate = useNavigate();

  // Query recent case records for data exploration
  const { data: casesData, isLoading: casesLoading } = useQuery({
    queryKey: ['readOnlyRecentCases'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/api/cases?limit=6');
        return res.data.cases || [];
      } catch {
        return [];
      }
    },
  });

  // Query courts for catalog coverage
  const { data: courtsData, isLoading: courtsLoading } = useQuery({
    queryKey: ['readOnlyCourts'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/api/courts?limit=6');
        return res.data.courts || [];
      } catch {
        return [];
      }
    },
  });

  const totalCourts = summary?.totalCourts || 0;
  const totalCases = summary?.totalCases || 0;
  const activeCases = summary?.activeCases || 0;
  const disposedCases = summary?.disposedCases || 0;
  const newToday = summary?.newCasesToday || 0;

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
      subvalue: 'National CNR Registry records',
      icon: Scale,
      iconBg: 'bg-indigo-50 text-indigo-600',
      badgeText: 'Verified CNRs',
      badgeVariant: 'navy',
    },
    {
      title: 'Pending Proceedings',
      value: activeCases.toLocaleString(),
      subvalue: 'Active court litigation dockets',
      icon: Activity,
      iconBg: 'bg-amber-50 text-amber-600',
      badgeText: `${activeCases} Active`,
      badgeVariant: 'warning',
    },
    {
      title: 'Disposed Cases',
      value: disposedCases.toLocaleString(),
      subvalue: 'Concluded judgments & final orders',
      icon: CheckCircle2,
      iconBg: 'bg-emerald-50 text-emerald-600',
      badgeText: `${disposedCases} Disposed`,
      badgeVariant: 'success',
    },
  ];

  return (
    <div className="space-y-6">
      {/* 4 Primary Data Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {summaryLoading
          ? Array.from({ length: 4 }).map((_, i) => <SkeletonCard key={i} />)
          : stats.map((stat) => <StatsCard key={stat.title} {...stat} />)}
      </div>

      {/* Exploration Grid: Recent Cases & Court Coverage */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Cases */}
        <Card>
          <CardHeader
            title="Recently Ingested Case Dockets"
            subtitle="Explore normalized judicial proceedings and party details"
            badge={<Badge variant="default" size="sm">Cases</Badge>}
          />

          <div className="divide-y divide-slate-100">
            {casesLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading cases...</div>
            ) : casesData?.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No cases ingested yet. Cases will appear once ingestion starts.
              </div>
            ) : (
              casesData?.map((c) => (
                <div
                  key={c.id || c.cnr}
                  onClick={() => navigate(`/cases/${c.cnr}`)}
                  className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="min-w-0 mr-3">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-blue-600">{c.cnr}</span>
                      <Badge variant={c.case_status === 'DISPOSED' ? 'success' : 'warning'} size="sm">
                        {c.case_status || 'PENDING'}
                      </Badge>
                    </div>
                    <p className="text-xs text-slate-700 font-medium truncate mt-0.5">
                      {c.title || `Case ${c.case_number || ''}`}
                    </p>
                  </div>
                  <div className="text-[11px] text-slate-400 font-mono shrink-0">
                    {c.court_name || c.case_type || 'View'}
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Court Complexes Coverage */}
        <Card>
          <CardHeader
            title="Court Establishments Directory"
            subtitle="Comprehensive jurisdictional hierarchy coverage"
            badge={<Badge variant="info" size="sm">Courts</Badge>}
          />

          <div className="divide-y divide-slate-100">
            {courtsLoading ? (
              <div className="p-6 text-center text-xs text-slate-400">Loading courts...</div>
            ) : courtsData?.length === 0 ? (
              <div className="py-8 text-center text-xs text-slate-400">
                No court establishments indexed yet.
              </div>
            ) : (
              courtsData?.map((court) => (
                <div
                  key={court.id}
                  onClick={() => navigate(`/courts/${court.id}`)}
                  className="py-3 px-2 flex items-center justify-between hover:bg-slate-50 rounded-lg cursor-pointer transition-colors"
                >
                  <div className="min-w-0 mr-3">
                    <span className="font-semibold text-xs text-slate-900 truncate block">
                      {court.name}
                    </span>
                    <span className="text-[11px] text-slate-500 font-mono">
                      {court.state_name || court.code} • {court.court_type || 'District Court'}
                    </span>
                  </div>
                  <Badge variant="navy" size="sm">
                    {court.total_cases ? `${court.total_cases} cases` : 'Active'}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </Card>
      </div>
    </div>
  );
};
