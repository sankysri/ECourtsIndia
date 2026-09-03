import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client.js';
import { useDispatch } from 'react-redux';
import { addToast } from '../../../store/slices/notificationSlice.js';
import {
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Building2,
  Database,
  Layers,
  Sparkles,
  X,
} from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { Badge } from '../../../components/common/Badge.jsx';

export const CourtSyncModal = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const [jobId, setJobId] = useState(null);
  const [jobStatus, setJobStatus] = useState(null);
  const [isPolling, setIsPolling] = useState(false);

  // Trigger sync mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/api/courts/sync');
      return res.data;
    },
    onSuccess: (data) => {
      setJobId(data.jobId);
      setIsPolling(true);
      setJobStatus({
        status: 'IN_PROGRESS',
        progress: 15,
        message: 'Dispatched court sync job to BullMQ queue...',
      });
    },
    onError: (err) => {
      dispatch(
        addToast({
          type: 'error',
          title: 'Sync Trigger Failed',
          message: err.message || 'Could not initiate court sync',
        })
      );
    },
  });

  // Poll status while job is in progress
  useEffect(() => {
    let intervalId;
    if (isPolling && jobId) {
      intervalId = setInterval(async () => {
        try {
          const res = await apiClient.get(`/api/courts/sync/status/${jobId}`);
          const job = res.data.syncJob;
          setJobStatus(job);

          if (job?.status === 'COMPLETED' || job?.status === 'FAILED') {
            setIsPolling(false);
            queryClient.invalidateQueries({ queryKey: ['courtsList'] });
            queryClient.invalidateQueries({ queryKey: ['courtHierarchy'] });
            queryClient.invalidateQueries({ queryKey: ['courtMetadata'] });
            queryClient.invalidateQueries({ queryKey: ['systemHealth'] });
            queryClient.invalidateQueries({ queryKey: ['auditLogs'] });

            if (job.status === 'COMPLETED') {
              dispatch(
                addToast({
                  type: 'success',
                  title: 'Court Synchronization Complete',
                  message: `Synchronized ${job.result?.courtsSynced || 0} courts across ${job.result?.statesSynced || 0} states.`,
                })
              );
            }
          }
        } catch (err) {
          console.error('Error polling sync status', err);
        }
      }, 600);
    }
    return () => clearInterval(intervalId);
  }, [isPolling, jobId, dispatch, queryClient]);

  if (!isOpen) return null;

  const handleStartSync = () => {
    setJobId(null);
    setJobStatus(null);
    syncMutation.mutate();
  };

  const isCompleted = jobStatus?.status === 'COMPLETED';
  const isFailed = jobStatus?.status === 'FAILED';
  const inProgress = syncMutation.isPending || isPolling || jobStatus?.status === 'IN_PROGRESS';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-lg w-full overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/60">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <RefreshCw className={`w-5 h-5 ${inProgress ? 'animate-spin' : ''}`} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Court Master Synchronization</h3>
              <p className="text-xs text-slate-500">Asynchronous eCourts judicial hierarchy ingest</p>
            </div>
          </div>
          {!inProgress && (
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Modal Body */}
        <div className="p-6 space-y-5">
          {!jobStatus && !inProgress && (
            <div className="space-y-4 text-xs text-slate-600">
              <p className="leading-relaxed">
                This administrative action pulls the national court directory, state jurisdictions, district complexes, and dynamic API capabilities from the eCourts developer API.
              </p>
              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2">
                <div className="font-semibold text-blue-900 flex items-center gap-1.5">
                  <Sparkles className="w-4 h-4 text-blue-600" /> Idempotent Ingestion Engine
                </div>
                <p className="text-blue-800/80 leading-relaxed text-[11px]">
                  Safe to run at any time. Existing court codes and metadata will be seamlessly updated without creating duplicate records.
                </p>
              </div>
            </div>
          )}

          {/* Progress View */}
          {(inProgress || isCompleted || isFailed) && (
            <div className="space-y-4">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-slate-900 flex items-center gap-2">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                  ) : isFailed ? (
                    <AlertCircle className="w-4 h-4 text-rose-600" />
                  ) : (
                    <RefreshCw className="w-4 h-4 animate-spin text-blue-600" />
                  )}
                  {jobStatus?.status || 'INITIALIZING'}
                </span>
                <span className="font-mono font-bold text-slate-700">
                  {jobStatus?.progress || 0}%
                </span>
              </div>

              {/* Progress Bar */}
              <div className="w-full bg-slate-100 rounded-full h-2.5 overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all duration-300 ${
                    isFailed ? 'bg-rose-500' : isCompleted ? 'bg-emerald-500' : 'bg-blue-600'
                  }`}
                  style={{ width: `${jobStatus?.progress || 0}%` }}
                />
              </div>

              {/* Step Message */}
              <p className="text-xs text-slate-600 bg-slate-50 p-3 rounded-lg border border-slate-200/70">
                {jobStatus?.message || 'Processing court master synchronization...'}
              </p>

              {/* Summary Stats after Completion */}
              {isCompleted && jobStatus?.result && (
                <div className="grid grid-cols-3 gap-2.5 pt-2">
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                    <div className="text-[10px] font-bold text-emerald-800 uppercase">Courts</div>
                    <div className="text-lg font-extrabold font-mono text-emerald-950">
                      {jobStatus.result.courtsSynced}
                    </div>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                    <div className="text-[10px] font-bold text-emerald-800 uppercase">Districts</div>
                    <div className="text-lg font-extrabold font-mono text-emerald-950">
                      {jobStatus.result.districtsSynced}
                    </div>
                  </div>
                  <div className="p-2.5 bg-emerald-50 rounded-xl border border-emerald-100 text-center">
                    <div className="text-[10px] font-bold text-emerald-800 uppercase">States</div>
                    <div className="text-lg font-extrabold font-mono text-emerald-950">
                      {jobStatus.result.statesSynced}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2.5">
          {!inProgress && !isCompleted && (
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
          )}

          {!inProgress && !isCompleted && (
            <Button
              variant="primary"
              size="sm"
              onClick={handleStartSync}
              isLoading={syncMutation.isPending}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Start Sync Now
            </Button>
          )}

          {isCompleted && (
            <Button variant="primary" size="sm" onClick={onClose}>
              Done
            </Button>
          )}

          {isFailed && (
            <Button variant="danger" size="sm" onClick={handleStartSync}>
              Retry Sync
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
