import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client.js';
import { Badge } from '../../../components/common/Badge.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { useDispatch } from 'react-redux';
import { addToast } from '../../../store/slices/notificationSlice.js';
import {
  Layers,
  Play,
  Pause,
  RotateCcw,
  Ban,
  Clock,
  Calendar,
  Building2,
  ListTree,
  CheckCircle2,
  AlertCircle,
} from 'lucide-react';

export const CampaignCard = ({ campaign, onInspectSegments }) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  // Controls Mutations
  const pauseMutation = useMutation({
    mutationFn: async () => apiClient.post(`/api/backfill/campaigns/${campaign.id}/pause`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backfillCampaigns'] });
      dispatch(addToast({ type: 'info', title: 'Campaign Paused', message: `Campaign "${campaign.name}" paused.` }));
    },
  });

  const resumeMutation = useMutation({
    mutationFn: async () => apiClient.post(`/api/backfill/campaigns/${campaign.id}/resume`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backfillCampaigns'] });
      dispatch(addToast({ type: 'success', title: 'Campaign Resumed', message: `Campaign "${campaign.name}" resumed.` }));
    },
  });

  const retryMutation = useMutation({
    mutationFn: async () => apiClient.post(`/api/backfill/campaigns/${campaign.id}/retry-failed`),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['backfillCampaigns'] });
      dispatch(addToast({ type: 'success', title: 'Retrying Failed Segments', message: `Dispatched retry for failed segments.` }));
    },
  });

  const cancelMutation = useMutation({
    mutationFn: async () => apiClient.post(`/api/backfill/campaigns/${campaign.id}/cancel`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['backfillCampaigns'] });
      dispatch(addToast({ type: 'warning', title: 'Campaign Cancelled', message: `Campaign "${campaign.name}" cancelled.` }));
    },
  });

  const total = campaign.total_jobs || 1;
  const completed = campaign.completed_jobs || 0;
  const failed = campaign.failed_jobs || 0;
  const progressPercent = Math.min(100, Math.round(((completed + failed) / total) * 100));

  const courtsCount = Array.isArray(campaign.selected_courts) ? campaign.selected_courts.length : 1;

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 p-5 space-y-4 shadow-card hover:border-blue-200 transition-all font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <h3 className="text-sm sm:text-base font-bold text-slate-900">{campaign.name}</h3>
            <Badge
              variant={
                campaign.status === 'COMPLETED'
                  ? 'success'
                  : campaign.status === 'RUNNING'
                  ? 'info'
                  : campaign.status === 'FAILED'
                  ? 'danger'
                  : campaign.status === 'PAUSED'
                  ? 'warning'
                  : 'default'
              }
              size="sm"
              dot
            >
              {campaign.status}
            </Badge>
          </div>

          <div className="flex flex-wrap items-center gap-3 text-xs text-slate-500 font-mono">
            <span>Range: <strong>{campaign.start_date?.slice(0, 4)} - {campaign.end_date?.slice(0, 4)}</strong></span>
            <span>•</span>
            <span>Courts: <strong>{courtsCount} Establishments</strong></span>
            <span>•</span>
            <span>Created: <strong>{new Date(campaign.created_at).toLocaleDateString()}</strong></span>
          </div>
        </div>

        {/* Action Controls */}
        <div className="flex items-center gap-1.5 self-start sm:self-center">
          {campaign.status === 'RUNNING' && (
            <Button
              variant="outline"
              size="xs"
              isLoading={pauseMutation.isPending}
              onClick={() => pauseMutation.mutate()}
              leftIcon={<Pause className="w-3 h-3" />}
            >
              Pause
            </Button>
          )}

          {campaign.status === 'PAUSED' && (
            <Button
              variant="primary"
              size="xs"
              isLoading={resumeMutation.isPending}
              onClick={() => resumeMutation.mutate()}
              leftIcon={<Play className="w-3 h-3" />}
            >
              Resume
            </Button>
          )}

          {failed > 0 && campaign.status !== 'CANCELLED' && (
            <Button
              variant="outline"
              size="xs"
              isLoading={retryMutation.isPending}
              onClick={() => retryMutation.mutate()}
              leftIcon={<RotateCcw className="w-3 h-3" />}
            >
              Retry ({failed})
            </Button>
          )}

          {campaign.status === 'RUNNING' && (
            <Button
              variant="ghost"
              size="xs"
              isLoading={cancelMutation.isPending}
              onClick={() => cancelMutation.mutate()}
              leftIcon={<Ban className="w-3 h-3 text-rose-500" />}
            >
              Cancel
            </Button>
          )}

          <Button
            variant="outline"
            size="xs"
            onClick={() => onInspectSegments(campaign.id)}
            leftIcon={<ListTree className="w-3 h-3 text-blue-600" />}
          >
            Segments ({total})
          </Button>
        </div>
      </div>

      {/* Progress Bar & Telemetry Grid */}
      <div className="space-y-2 text-xs">
        <div className="flex items-center justify-between text-[11px] text-slate-600">
          <span>
            Overall Segment Progress: <strong>{completed}/{total}</strong> Jobs
          </span>
          <span className="font-mono font-bold text-blue-700">{progressPercent}%</span>
        </div>

        <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all ${
              campaign.status === 'COMPLETED'
                ? 'bg-emerald-500'
                : campaign.status === 'PAUSED'
                ? 'bg-amber-500'
                : campaign.status === 'FAILED'
                ? 'bg-rose-500'
                : 'bg-blue-600'
            }`}
            style={{ width: `${progressPercent}%` }}
          />
        </div>

        {/* Telemetry Pills */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pt-2 text-xs">
          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Historical CNRs Found</span>
            <div className="text-xs font-mono font-bold text-slate-900 mt-0.5">
              {campaign.total_cnrs_discovered || 0}
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Completed Jobs</span>
            <div className="text-xs font-mono font-bold text-emerald-700 mt-0.5">
              {completed} / {total}
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Failed Segments</span>
            <div className="text-xs font-mono font-bold text-rose-700 mt-0.5">
              {failed}
            </div>
          </div>

          <div className="p-2.5 bg-slate-50 rounded-lg border border-slate-200/80">
            <span className="text-[10px] text-slate-400 font-semibold uppercase">Duration</span>
            <div className="text-xs font-mono font-bold text-slate-700 mt-0.5">
              {campaign.completed_at ? 'Completed' : 'Running...'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
