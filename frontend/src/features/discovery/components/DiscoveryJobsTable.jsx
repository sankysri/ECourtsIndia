import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client.js';
import { useDispatch } from 'react-redux';
import { addToast } from '../../../store/slices/notificationSlice.js';
import { Badge } from '../../../components/common/Badge.jsx';
import { Button } from '../../../components/common/Button.jsx';
import {
  Compass,
  Play,
  Pause,
  RotateCw,
  XCircle,
  Building2,
  Calendar,
  Clock,
  Layers,
  Sparkles,
} from 'lucide-react';

export const DiscoveryJobsTable = ({ jobs = [], isLoading }) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  // Pause Mutation
  const pauseMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiClient.post(`/api/discovery/jobs/${id}/pause`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discoveryJobs'] });
      dispatch(addToast({ type: 'info', title: 'Job Paused', message: 'Discovery job paused.' }));
    },
  });

  // Resume Mutation
  const resumeMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiClient.post(`/api/discovery/jobs/${id}/resume`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discoveryJobs'] });
      dispatch(addToast({ type: 'success', title: 'Job Resumed', message: 'Discovery job resumed.' }));
    },
  });

  // Retry Mutation
  const retryMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiClient.post(`/api/discovery/jobs/${id}/retry`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discoveryJobs'] });
      dispatch(addToast({ type: 'info', title: 'Job Retrying', message: 'Discovery job retried.' }));
    },
  });

  // Cancel Mutation
  const cancelMutation = useMutation({
    mutationFn: async (id) => {
      const res = await apiClient.post(`/api/discovery/jobs/${id}/cancel`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['discoveryJobs'] });
      dispatch(addToast({ type: 'warning', title: 'Job Cancelled', message: 'Discovery job cancelled.' }));
    },
  });

  if (!jobs.length && !isLoading) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
        No case discovery jobs created yet. Click <strong>"Start Discovery"</strong> to initiate a new ingestion run.
      </div>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success" size="sm" dot>COMPLETED</Badge>;
      case 'RUNNING':
        return <Badge variant="info" size="sm" dot>RUNNING</Badge>;
      case 'PAUSED':
        return <Badge variant="warning" size="sm" dot>PAUSED</Badge>;
      case 'FAILED':
        return <Badge variant="danger" size="sm" dot>FAILED</Badge>;
      case 'CANCELLED':
        return <Badge variant="default" size="sm">CANCELLED</Badge>;
      default:
        return <Badge variant="navy" size="sm">QUEUED</Badge>;
    }
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-card overflow-hidden font-sans">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th className="py-3 px-4">Court Establishment</th>
              <th className="py-3 px-4">Strategy</th>
              <th className="py-3 px-4">Filters</th>
              <th className="py-3 px-4">Progress</th>
              <th className="py-3 px-4">Discovered CNRs</th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {jobs.map((job) => {
              const totalPages = job.total_pages || 1;
              const currentPage = job.current_page || 1;
              const percent = job.status === 'COMPLETED' ? 100 : Math.min(Math.round((currentPage / totalPages) * 100), 100);

              const isRunning = job.status === 'RUNNING' || job.status === 'QUEUED';
              const isPaused = job.status === 'PAUSED';
              const isFailed = job.status === 'FAILED';

              return (
                <tr key={job.id} className="hover:bg-slate-50/70 transition-colors">
                  {/* Court Name */}
                  <td className="py-3.5 px-4 font-semibold text-slate-900">
                    <div className="flex items-center gap-2">
                      <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-700 flex items-center justify-center shrink-0">
                        <Building2 className="w-3.5 h-3.5" />
                      </div>
                      <div>
                        <div className="text-slate-900 font-semibold">{job.court_name}</div>
                        <div className="text-[10px] text-slate-400 font-mono font-normal">
                          {job.court_code} • {job.state_code}
                        </div>
                      </div>
                    </div>
                  </td>

                  {/* Strategy Badge */}
                  <td className="py-3.5 px-4">
                    <Badge variant={job.strategy === 'HISTORICAL_BACKFILL' ? 'purple' : 'navy'} size="sm">
                      {job.strategy.replace(/_/g, ' ')}
                    </Badge>
                  </td>

                  {/* Filters Summary */}
                  <td className="py-3.5 px-4 text-slate-600">
                    <div className="space-y-0.5">
                      <div className="font-mono text-slate-800">
                        Year: <strong>{job.filters?.filingYear || 'All'}</strong> • Type: <strong>{job.filters?.caseType || 'All'}</strong>
                      </div>
                      {job.filters?.partyName && (
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]" title={job.filters.partyName}>
                          Party: {job.filters.partyName}
                        </div>
                      )}
                    </div>
                  </td>

                  {/* Progress Bar & Page */}
                  <td className="py-3.5 px-4 min-w-[140px]">
                    <div className="space-y-1">
                      <div className="flex items-center justify-between text-[10px] text-slate-500 font-mono">
                        <span>Page {currentPage}/{totalPages}</span>
                        <span className="font-bold">{percent}%</span>
                      </div>
                      <div className="w-full bg-slate-100 rounded-full h-1.5 overflow-hidden">
                        <div
                          className={`h-full transition-all duration-300 ${
                            isFailed ? 'bg-rose-500' : job.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-blue-600'
                          }`}
                          style={{ width: `${percent}%` }}
                        />
                      </div>
                    </div>
                  </td>

                  {/* CNRs Found (New vs Existing) */}
                  <td className="py-3.5 px-4">
                    <div className="flex items-center gap-2">
                      <span className="font-mono font-bold text-slate-900 text-xs">
                        {job.records_found || 0}
                      </span>
                      <div className="flex items-center gap-1 text-[10px] font-mono">
                        <span className="px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 font-semibold" title="New CNRs registered">
                          +{job.new_cases_found || 0}
                        </span>
                        <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-600" title="Existing CNRs refreshed">
                          {job.existing_cases_found || 0} existing
                        </span>
                      </div>
                    </div>
                  </td>

                  {/* Status Badge */}
                  <td className="py-3.5 px-4">
                    {getStatusBadge(job.status)}
                    {job.error_message && (
                      <div className="text-[10px] text-rose-600 mt-1 truncate max-w-[120px]" title={job.error_message}>
                        {job.error_message}
                      </div>
                    )}
                  </td>

                  {/* Action Buttons */}
                  <td className="py-3.5 px-4 text-right">
                    <div className="flex items-center justify-end gap-1.5">
                      {isRunning && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => pauseMutation.mutate(job.id)}
                          isLoading={pauseMutation.isPending}
                          leftIcon={<Pause className="w-3 h-3 text-amber-600" />}
                        >
                          Pause
                        </Button>
                      )}

                      {isPaused && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => resumeMutation.mutate(job.id)}
                          isLoading={resumeMutation.isPending}
                          leftIcon={<Play className="w-3 h-3 text-emerald-600" />}
                        >
                          Resume
                        </Button>
                      )}

                      {isFailed && (
                        <Button
                          variant="outline"
                          size="xs"
                          onClick={() => retryMutation.mutate(job.id)}
                          isLoading={retryMutation.isPending}
                          leftIcon={<RotateCw className="w-3 h-3 text-blue-600" />}
                        >
                          Retry
                        </Button>
                      )}

                      {(isRunning || isPaused) && (
                        <button
                          onClick={() => cancelMutation.mutate(job.id)}
                          className="p-1 rounded-md text-slate-400 hover:text-rose-600 hover:bg-slate-100 transition-colors"
                          title="Cancel Job"
                        >
                          <XCircle className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
};
