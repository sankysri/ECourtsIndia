import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client.js';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { CreateCampaignModal } from './components/CreateCampaignModal.jsx';
import { PermissionGuard } from '../../components/common/PermissionGuard.jsx';
import { PERMISSIONS } from '../../constants/permissions.js';
import { CampaignCard } from './components/CampaignCard.jsx';
import { CampaignSegmentsDrawer } from './components/CampaignSegmentsDrawer.jsx';
import {
  Layers,
  Sparkles,
  Plus,
  RefreshCw,
  Clock,
  Compass,
  Building2,
  CheckCircle2,
  AlertTriangle,
  Activity,
} from 'lucide-react';

export const SyncCenterPage = () => {
  const [isCreateOpen, setIsCreateOpen] = useState(false);
  const [inspectingCampaignId, setInspectingCampaignId] = useState(null);
  const [selectedStatus, setSelectedStatus] = useState('');

  // 1. Fetch Global Backfill Stats
  const { data: statsData } = useQuery({
    queryKey: ['backfillStats'],
    queryFn: async () => {
      const res = await apiClient.get('/api/backfill/stats');
      return res.data;
    },
    refetchInterval: 5000,
  });

  // 2. Fetch Backfill Campaigns
  const {
    data: campaignsData,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['backfillCampaigns', selectedStatus],
    queryFn: async () => {
      const params = selectedStatus ? `?status=${selectedStatus}` : '';
      const res = await apiClient.get(`/api/backfill/campaigns${params}`);
      return res.data;
    },
    refetchInterval: 5000,
  });

  const campaigns = campaignsData?.campaigns || [];
  const stats = statsData || {
    totalCampaigns: 0,
    activeCampaigns: 0,
    totalCnrsDiscovered: 0,
    completedJobs: 0,
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Historical Data Backfill Engine
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Segmented historical court ingestion, automated rate-limit safety, and real-time campaign orchestration
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>

          <PermissionGuard permission={PERMISSIONS.START_SYNC}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setIsCreateOpen(true)}
              leftIcon={<Plus className="w-3.5 h-3.5" />}
            >
              New Backfill Campaign
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* 4 Summary Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <Card className="p-4 bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Total Campaigns</span>
              <div className="text-lg sm:text-xl font-mono font-extrabold text-slate-900">
                {stats.totalCampaigns}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-amber-50 text-amber-700 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Active Running</span>
              <div className="text-lg sm:text-xl font-mono font-extrabold text-amber-600">
                {stats.activeCampaigns}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-purple-50 text-purple-700 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Historical CNRs</span>
              <div className="text-lg sm:text-xl font-mono font-extrabold text-purple-700">
                {stats.totalCnrsDiscovered}
              </div>
            </div>
          </div>
        </Card>

        <Card className="p-4 bg-white border border-slate-200/80 shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-emerald-50 text-emerald-700 flex items-center justify-center">
              <CheckCircle2 className="w-5 h-5" />
            </div>
            <div>
              <span className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Completed Jobs</span>
              <div className="text-lg sm:text-xl font-mono font-extrabold text-emerald-700">
                {stats.completedJobs}
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Filter Tabs */}
      <div className="flex items-center justify-between border-b border-slate-200 pb-2 text-xs font-bold">
        <div className="flex items-center gap-2 overflow-x-auto">
          {[
            { key: '', label: 'All Campaigns' },
            { key: 'RUNNING', label: 'Running' },
            { key: 'PAUSED', label: 'Paused' },
            { key: 'COMPLETED', label: 'Completed' },
            { key: 'CANCELLED', label: 'Cancelled' },
          ].map((tab) => (
            <button
              key={tab.key}
              onClick={() => setSelectedStatus(tab.key)}
              className={`px-3 py-1.5 rounded-lg transition-all ${
                selectedStatus === tab.key
                  ? 'bg-blue-600 text-white font-bold shadow-2xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Campaign Cards List */}
      <div className="space-y-4">
        {isLoading ? (
          <div className="py-16 text-center text-slate-400 text-xs">
            Loading historical backfill campaigns...
          </div>
        ) : !campaigns.length ? (
          <Card className="p-12 text-center text-slate-500 space-y-3">
            <div className="w-12 h-12 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mx-auto">
              <Layers className="w-6 h-6" />
            </div>
            <h3 className="text-sm font-bold text-slate-900">No Backfill Campaigns Found</h3>
            <p className="text-xs text-slate-400 max-w-sm mx-auto">
              Historical backfill campaigns allow you to segment multi-year case ingestion across multiple court complexes safely.
            </p>
            <Button variant="primary" size="sm" onClick={() => setIsCreateOpen(true)} leftIcon={<Plus className="w-3.5 h-3.5" />}>
              Create First Backfill Campaign
            </Button>
          </Card>
        ) : (
          campaigns.map((camp) => (
            <CampaignCard
              key={camp.id}
              campaign={camp}
              onInspectSegments={(id) => setInspectingCampaignId(id)}
            />
          ))
        )}
      </div>

      {/* Create Modal */}
      <CreateCampaignModal isOpen={isCreateOpen} onClose={() => setIsCreateOpen(false)} />

      {/* Segments Drawer */}
      {inspectingCampaignId && (
        <CampaignSegmentsDrawer
          campaignId={inspectingCampaignId}
          onClose={() => setInspectingCampaignId(null)}
        />
      )}
    </div>
  );
};
