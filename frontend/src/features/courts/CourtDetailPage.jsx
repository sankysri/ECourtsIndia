import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.js';
import { Card, CardHeader } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { useDispatch } from 'react-redux';
import { addToast } from '../../store/slices/notificationSlice.js';
import {
  Building2,
  ChevronRight,
  ArrowLeft,
  Scale,
  Activity,
  Layers,
  Search,
  FileText,
  Clock,
  RefreshCw,
  MapPin,
  Compass,
  Zap,
  ShieldCheck,
} from 'lucide-react';

export const CourtDetailPage = () => {
  const { courtId } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview'); // 'overview' | 'cases' | 'discovery' | 'sync' | 'api'

  // Fetch court details
  const {
    data: courtData,
    isLoading: courtLoading,
    error: courtError,
  } = useQuery({
    queryKey: ['courtDetail', courtId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/courts/${courtId}`);
      return res.data.court;
    },
  });

  // Fetch court API logs
  const { data: logsData, isLoading: logsLoading } = useQuery({
    queryKey: ['courtLogs', courtData?.code],
    queryFn: async () => {
      if (!courtData?.code) return [];
      const res = await apiClient.get(`/api/courts/${courtData.code}/logs`);
      return res.data.logs;
    },
    enabled: Boolean(courtData?.code && activeTab === 'api'),
  });

  // Quick sync mutation for this court
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/api/courts/sync');
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['courtDetail', courtId] });
      dispatch(
        addToast({
          type: 'success',
          title: 'Court Sync Triggered',
          message: `Synchronizing court ${courtData?.name}...`,
        })
      );
    },
  });

  if (courtLoading) {
    return (
      <div className="py-20 text-center text-xs text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
        <p>Loading court complex metadata...</p>
      </div>
    );
  }

  if (courtError || !courtData) {
    return (
      <div className="py-16 text-center space-y-4">
        <p className="text-sm font-semibold text-rose-600">Court establishment not found.</p>
        <Button variant="outline" size="sm" onClick={() => navigate('/courts')} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
          Back to Courts Master
        </Button>
      </div>
    );
  }

  const court = courtData;

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Breadcrumb Navigation */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/courts" className="hover:text-blue-600 font-medium transition-colors">
          Courts Master
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-slate-700 font-mono">{court.state_code}</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-slate-900 font-semibold truncate max-w-sm">{court.name}</span>
      </div>

      {/* Header Banner */}
      <Card className="p-6 bg-white border border-slate-200/80 shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 shadow-2xs font-bold">
              <Building2 className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  {court.name}
                </h1>
                <Badge
                  variant={
                    court.type === 'HIGH_COURT'
                      ? 'purple'
                      : court.type === 'CITY_CIVIL_COURT'
                      ? 'info'
                      : 'default'
                  }
                  size="sm"
                >
                  {court.type.replace(/_/g, ' ')}
                </Badge>
                <Badge variant={court.status === 'ACTIVE' ? 'success' : 'warning'} size="sm" dot>
                  {court.status || 'ACTIVE'}
                </Badge>
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2 font-mono">
                <span>Code: <strong className="text-slate-800">{court.code}</strong></span>
                <span>•</span>
                <span>Jurisdiction: <strong className="text-slate-800">{court.state_name} ({court.state_code})</strong></span>
                {court.district_name && (
                  <>
                    <span>•</span>
                    <span>District: <strong className="text-slate-800">{court.district_name}</strong></span>
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-center">
            <Button
              variant="outline"
              size="sm"
              isLoading={syncMutation.isPending}
              onClick={() => syncMutation.mutate()}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Sync Now
            </Button>
          </div>
        </div>
      </Card>

      {/* 5 Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 transition-all border-b-2 ${
            activeTab === 'overview'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Building2 className="w-4 h-4" />
            Overview & Details
          </div>
        </button>

        <button
          onClick={() => setActiveTab('cases')}
          className={`pb-3 px-3 transition-all border-b-2 ${
            activeTab === 'cases'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4" />
            Cases & Dockets
          </div>
        </button>

        <button
          onClick={() => setActiveTab('discovery')}
          className={`pb-3 px-3 transition-all border-b-2 ${
            activeTab === 'discovery'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4" />
            Discovery Jobs
          </div>
        </button>

        <button
          onClick={() => setActiveTab('sync')}
          className={`pb-3 px-3 transition-all border-b-2 ${
            activeTab === 'sync'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <RefreshCw className="w-4 h-4" />
            Sync Jobs
          </div>
        </button>

        <button
          onClick={() => setActiveTab('api')}
          className={`pb-3 px-3 transition-all border-b-2 ${
            activeTab === 'api'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Zap className="w-4 h-4" />
            API Activity & Telemetry
          </div>
        </button>
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 space-y-4">
            <CardHeader
              title="Jurisdiction & Structural Hierarchy"
              subtitle="eCourts India jurisdictional registry identifiers"
            />

            <div className="grid grid-cols-2 gap-4 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">State Jurisdiction</span>
                <div className="text-sm font-bold text-slate-900 mt-1">{court.state_name} ({court.state_code})</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">District Establishment</span>
                <div className="text-sm font-bold text-slate-900 mt-1">{court.district_name || 'State Principal Bench'}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Court Type Classification</span>
                <div className="text-sm font-bold text-slate-900 mt-1">{court.type.replace(/_/g, ' ')}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Total Synchronized Cases</span>
                <div className="text-sm font-bold font-mono text-slate-900 mt-1">{court.total_cases?.toLocaleString() || 0}</div>
              </div>
            </div>

            {court.parent_court_name && (
              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 text-xs">
                <span className="font-semibold text-blue-900">Parent Court Establishment:</span>{' '}
                <span className="text-blue-800">{court.parent_court_name}</span>
              </div>
            )}
          </Card>

          {/* Quick Telemetry Card */}
          <Card className="space-y-4">
            <CardHeader title="Sync Telemetry" subtitle="Synchronization state" />

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Last Sync Timestamp:</span>
                <span className="font-mono text-slate-800">
                  {court.last_sync_at ? new Date(court.last_sync_at).toLocaleString() : 'Pending'}
                </span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Database Record ID:</span>
                <span className="font-mono text-[10px] text-slate-600 truncate max-w-[120px]" title={court.id}>
                  {court.id}
                </span>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Crawler Discovery:</span>
                <Badge variant="info" size="sm">Configured</Badge>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: CASES */}
      {activeTab === 'cases' && (
        <EmptyState
          icon={Scale}
          title="Case Ingestion for this Court"
          description={`Case discovery and CNR docket indexing for ${court.name} can be initiated from the Discovery Engine.`}
          actionText="Explore Discovery Engine"
          onAction={() => navigate('/discovery')}
        />
      )}

      {/* TAB 3: DISCOVERY JOBS */}
      {activeTab === 'discovery' && (
        <EmptyState
          icon={Compass}
          title="Discovery Jobs Pipeline"
          description={`Automated scrapers will target ${court.name} (Code: ${court.code}) during daily cron runs.`}
          actionText="Configure Discovery"
          onAction={() => navigate('/discovery')}
        />
      )}

      {/* TAB 4: SYNC JOBS */}
      {activeTab === 'sync' && (
        <Card>
          <CardHeader
            title="Court Synchronization History"
            subtitle={`Recent BullMQ courtSyncQueue execution records for ${court.code}`}
          />

          <div className="p-6 text-center text-xs text-slate-500 bg-slate-50 rounded-xl border border-slate-200">
            <Clock className="w-5 h-5 text-slate-400 mx-auto mb-2" />
            Court hierarchy synchronized successfully on {new Date(court.last_sync_at || Date.now()).toLocaleString()}.
          </div>
        </Card>
      )}

      {/* TAB 5: API ACTIVITY */}
      {activeTab === 'api' && (
        <Card>
          <CardHeader
            title="eCourts API Gateway Request Logs"
            subtitle={`Recent outbound API calls recorded for court code ${court.code}`}
            badge={<Badge variant="navy" size="sm">api_request_logs</Badge>}
          />

          <div className="overflow-x-auto">
            {logsLoading ? (
              <div className="p-8 text-center text-xs text-slate-400">Loading API activity logs...</div>
            ) : !logsData?.length ? (
              <div className="p-8 text-center text-xs text-slate-500">
                No direct API logs recorded yet for this court code.
              </div>
            ) : (
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 font-semibold uppercase text-[11px]">
                  <tr>
                    <th className="py-3 px-4">Timestamp</th>
                    <th className="py-3 px-4">Endpoint</th>
                    <th className="py-3 px-4">Method</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4">Latency</th>
                    <th className="py-3 px-4">Cost ($)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 font-mono text-xs">
                  {logsData.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50">
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {new Date(log.created_at).toLocaleTimeString()}
                      </td>
                      <td className="py-2.5 px-4 font-semibold text-slate-900">{log.endpoint}</td>
                      <td className="py-2.5 px-4 font-bold text-blue-600">{log.method}</td>
                      <td className="py-2.5 px-4">
                        <Badge variant={log.success ? 'success' : 'danger'} size="sm">
                          {log.status_code}
                        </Badge>
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{log.response_time_ms} ms</td>
                      <td className="py-2.5 px-4 text-slate-500">${log.estimated_cost}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
