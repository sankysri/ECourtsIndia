import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client.js';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { DiscoveryJobsTable } from './components/DiscoveryJobsTable.jsx';
import { CnrRegistryTable } from './components/CnrRegistryTable.jsx';
import { CreateDiscoveryWizard } from './components/CreateDiscoveryWizard.jsx';
import { DailyDiscoveryPanel } from './components/DailyDiscoveryPanel.jsx';
import { DailyRunsHistoryTable } from './components/DailyRunsHistoryTable.jsx';
import { PermissionGuard } from '../../components/common/PermissionGuard.jsx';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  Compass,
  Plus,
  Scale,
  Clock,
  Sparkles,
  Layers,
  Activity,
  CheckCircle2,
  RefreshCw,
  Search,
  History,
} from 'lucide-react';

export const DiscoveryPage = () => {
  const [activeTab, setActiveTab] = useState('jobs'); // 'jobs' | 'registry' | 'daily'
  const [wizardOpen, setWizardOpen] = useState(false);

  // 1. Fetch Global Registry Stats
  const { data: statsData } = useQuery({
    queryKey: ['discoveryStats'],
    queryFn: async () => {
      const res = await apiClient.get('/api/discovery/registry/stats');
      return res.data.stats;
    },
    refetchInterval: 3000,
  });

  // 2. Fetch Discovery Jobs
  const {
    data: jobsData,
    isLoading: jobsLoading,
    refetch: refetchJobs,
  } = useQuery({
    queryKey: ['discoveryJobs'],
    queryFn: async () => {
      const res = await apiClient.get('/api/discovery/jobs?limit=50');
      return res.data.jobs;
    },
    refetchInterval: 2000,
  });

  // 3. Fetch Daily Discovery Scheduler Status (M6)
  const { data: dailyConfig, refetch: refetchDailyStatus } = useQuery({
    queryKey: ['dailyDiscoveryStatus'],
    queryFn: async () => {
      const res = await apiClient.get('/api/discovery/daily/status');
      return res.data.status;
    },
    refetchInterval: 4000,
  });

  // 4. Fetch Daily Discovery Run History (M6)
  const { data: dailyHistoryData, isLoading: dailyHistoryLoading, refetch: refetchDailyHistory } = useQuery({
    queryKey: ['dailyDiscoveryHistory'],
    queryFn: async () => {
      const res = await apiClient.get('/api/discovery/daily/history?limit=30');
      return res.data.runs;
    },
    refetchInterval: 4000,
  });

  const totalDiscovered = statsData?.totalDiscovered || 0;
  const newToday = statsData?.newToday || 0;
  const pendingSync = statsData?.pendingDetailSync || 0;
  const activeJobs = statsData?.activeDiscoveryJobs || 0;

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Case Discovery Engine & CNR Registry
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Systematic eCourts query ingestion, automated daily crawler & CNR deduplication registry
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <PermissionGuard permission={PERMISSIONS.START_DISCOVERY}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setWizardOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              Start Manual Discovery
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* M6 Daily Discovery Status Hero Banner */}
      <DailyDiscoveryPanel
        config={dailyConfig}
        onTriggerSuccess={() => {
          refetchJobs();
          refetchDailyHistory();
        }}
      />

      {/* Aggregate Metric Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Total CNRs Discovered</span>
            <Scale className="w-4 h-4 text-blue-600" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 mt-2">
            {totalDiscovered.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Ingested across all courts</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">New CNRs Today</span>
            <Sparkles className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-emerald-600 mt-2">
            +{newToday.toLocaleString()}
          </div>
          <div className="text-[11px] text-emerald-700 font-semibold mt-1">Unique docket entries</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Pending Detail Sync</span>
            <Clock className="w-4 h-4 text-amber-600" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-amber-600 mt-2">
            {pendingSync.toLocaleString()}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">Ready for detail sync queue</div>
        </Card>

        <Card className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500 uppercase">Active Discovery Jobs</span>
            <Activity className="w-4 h-4 text-purple-600" />
          </div>
          <div className="text-2xl font-extrabold font-mono text-purple-600 mt-2">
            {activeJobs} Active
          </div>
          <div className="text-[11px] text-slate-500 mt-1">BullMQ caseDiscoveryQueue</div>
        </Card>
      </div>

      {/* Main Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-bold">
        <button
          onClick={() => setActiveTab('jobs')}
          className={`pb-3 px-3 transition-all border-b-2 ${
            activeTab === 'jobs'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Compass className="w-4 h-4" />
            Discovery Jobs ({jobsData?.length || 0})
          </div>
        </button>

        <button
          onClick={() => setActiveTab('daily')}
          className={`pb-3 px-3 transition-all border-b-2 ${
            activeTab === 'daily'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <History className="w-4 h-4" />
            Daily Run History ({dailyHistoryData?.length || 0})
          </div>
        </button>

        <button
          onClick={() => setActiveTab('registry')}
          className={`pb-3 px-3 transition-all border-b-2 ${
            activeTab === 'registry'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4" />
            CNR Case Registry ({totalDiscovered})
          </div>
        </button>
      </div>

      {/* View Content */}
      {activeTab === 'jobs' && (
        <DiscoveryJobsTable jobs={jobsData || []} isLoading={jobsLoading} />
      )}

      {activeTab === 'daily' && (
        <DailyRunsHistoryTable runs={dailyHistoryData || []} isLoading={dailyHistoryLoading} />
      )}

      {activeTab === 'registry' && (
        <CnrRegistryTable />
      )}

      {/* Create Discovery Wizard Modal */}
      <CreateDiscoveryWizard
        isOpen={wizardOpen}
        onClose={() => setWizardOpen(false)}
        onJobCreated={() => refetchJobs()}
      />
    </div>
  );
};
