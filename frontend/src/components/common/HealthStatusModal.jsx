import React, { useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.js';
import { setHealthModalOpen } from '../../store/slices/uiSlice.js';
import { addToast } from '../../store/slices/notificationSlice.js';
import {
  Activity,
  CheckCircle2,
  AlertCircle,
  Database,
  Layers,
  Server,
  Cloud,
  RefreshCw,
  Play,
  X,
} from 'lucide-react';
import { Badge } from './Badge.jsx';
import { Button } from './Button.jsx';

export const HealthStatusModal = () => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const isOpen = useSelector((state) => state.ui.healthModalOpen);
  const [selectedQueue, setSelectedQueue] = useState('caseDiscoveryQueue');

  const { data: healthData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['systemHealth'],
    queryFn: async () => {
      const res = await apiClient.get('/health');
      return res.data;
    },
    enabled: isOpen,
    refetchInterval: isOpen ? 10000 : false,
  });

  const testJobMutation = useMutation({
    mutationFn: async (queueName) => {
      const res = await apiClient.post('/api/queues/test-job', {
        queueName,
        payload: { triggeredFrom: 'HealthStatusModal', timestamp: new Date().toISOString() },
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['systemHealth'] });
      queryClient.invalidateQueries({ queryKey: ['queueStatus'] });
      dispatch(
        addToast({
          type: 'success',
          title: 'Queue Test Job Dispatched',
          message: `Job ${data?.job?.jobId || 'ID'} dispatched to ${selectedQueue}`,
        })
      );
    },
    onError: (err) => {
      dispatch(
        addToast({
          type: 'error',
          title: 'Dispatch Failed',
          message: err.message || 'Could not dispatch test job',
        })
      );
    },
  });

  if (!isOpen) return null;

  const services = healthData?.services;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Modal Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/50">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
              <Activity className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">System Telemetry & Health</h3>
              <p className="text-xs text-slate-500">Live service heartbeat & queue infrastructure</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => refetch()}
              disabled={isFetching}
              className="p-1.5 text-slate-500 hover:text-slate-800 hover:bg-slate-200/60 rounded-lg transition-colors"
              title="Refresh status"
            >
              <RefreshCw className={`w-4 h-4 ${isFetching ? 'animate-spin text-blue-600' : ''}`} />
            </button>
            <button
              onClick={() => dispatch(setHealthModalOpen(false))}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Body */}
        <div className="p-6 overflow-y-auto space-y-6">
          {isLoading ? (
            <div className="py-12 text-center text-slate-500 flex flex-col items-center gap-3">
              <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
              <p className="text-sm">Fetching telemetry status...</p>
            </div>
          ) : (
            <>
              {/* Overall Status Banner */}
              <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl border border-slate-200/70">
                <div className="flex items-center gap-3">
                  {healthData?.status === 'UP' ? (
                    <CheckCircle2 className="w-5 h-5 text-emerald-600 shrink-0" />
                  ) : (
                    <AlertCircle className="w-5 h-5 text-amber-600 shrink-0" />
                  )}
                  <div>
                    <div className="text-sm font-semibold text-slate-900">
                      System Status: {healthData?.status}
                    </div>
                    <div className="text-xs text-slate-500">
                      Uptime: {Math.floor((healthData?.uptimeSeconds || 0) / 60)} min | Version:{' '}
                      {healthData?.version}
                    </div>
                  </div>
                </div>
                <Badge variant={healthData?.status === 'UP' ? 'success' : 'warning'} dot>
                  {healthData?.status === 'UP' ? 'OPERATIONAL' : 'DEGRADED'}
                </Badge>
              </div>

              {/* Core Services Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                {/* Database */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Database className="w-4 h-4 text-blue-600" />
                      <span className="text-xs font-semibold">PostgreSQL</span>
                    </div>
                    <Badge
                      variant={services?.database?.status === 'CONNECTED' ? 'success' : 'warning'}
                      size="sm"
                    >
                      {services?.database?.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {services?.database?.fallbackActive
                      ? 'In-Memory Resilient DB active'
                      : 'Primary PostgreSQL pool ready'}
                  </p>
                </div>

                {/* Redis */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Server className="w-4 h-4 text-red-600" />
                      <span className="text-xs font-semibold">Redis</span>
                    </div>
                    <Badge
                      variant={services?.redis?.status === 'CONNECTED' ? 'success' : 'warning'}
                      size="sm"
                    >
                      {services?.redis?.status}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    {services?.redis?.status === 'CONNECTED'
                      ? 'BullMQ broker active'
                      : 'Standby / Resilient queue mode'}
                  </p>
                </div>

                {/* S3 Storage */}
                <div className="p-3.5 rounded-xl border border-slate-200 bg-white shadow-sm space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 text-slate-700">
                      <Cloud className="w-4 h-4 text-amber-600" />
                      <span className="text-xs font-semibold">AWS S3</span>
                    </div>
                    <Badge variant="navy" size="sm">
                      {services?.storage?.mode}
                    </Badge>
                  </div>
                  <p className="text-[11px] text-slate-500">
                    Bucket: {services?.storage?.bucket || 'ecourts-documents'}
                  </p>
                </div>
              </div>

              {/* Queues List */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider flex items-center gap-2">
                    <Layers className="w-4 h-4 text-slate-600" />
                    BullMQ Ingestion Queues ({services?.queues?.totalQueues || 6})
                  </h4>
                  <span className="text-xs text-slate-500">
                    Completed: {services?.queues?.telemetry?.totalCompleted || 0} jobs
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {services?.queues?.queues?.map((q) => (
                    <div
                      key={q.name}
                      className="p-3 rounded-lg border border-slate-200/80 bg-slate-50/50 flex items-center justify-between text-xs"
                    >
                      <div>
                        <div className="font-mono font-medium text-slate-900">{q.name}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">
                          Active: {q.metrics.active} | Completed: {q.metrics.completed}
                        </div>
                      </div>
                      <Badge variant={q.status === 'HEALTHY' ? 'success' : 'default'} size="sm">
                        {q.status}
                      </Badge>
                    </div>
                  ))}
                </div>
              </div>

              {/* Trigger Queue Test Job Form */}
              <div className="p-4 rounded-xl border border-blue-100 bg-blue-50/50 space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h5 className="text-xs font-bold text-blue-950 uppercase tracking-wide">
                      Test Queue Dispatcher
                    </h5>
                    <p className="text-xs text-blue-800/80">
                      Dispatches a heartbeat test job to verify worker processing
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap sm:flex-nowrap items-center gap-2.5">
                  <select
                    value={selectedQueue}
                    onChange={(e) => setSelectedQueue(e.target.value)}
                    className="flex-1 text-xs bg-white border border-slate-300 rounded-lg px-3 py-2 font-mono text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="caseDiscoveryQueue">caseDiscoveryQueue</option>
                    <option value="courtSyncQueue">courtSyncQueue</option>
                    <option value="caseDetailQueue">caseDetailQueue</option>
                    <option value="caseSyncQueue">caseSyncQueue</option>
                    <option value="documentQueue">documentQueue</option>
                    <option value="indexQueue">indexQueue</option>
                  </select>

                  <Button
                    size="sm"
                    variant="primary"
                    isLoading={testJobMutation.isPending}
                    onClick={() => testJobMutation.mutate(selectedQueue)}
                    leftIcon={<Play className="w-3.5 h-3.5 fill-current" />}
                  >
                    Dispatch Test Job
                  </Button>
                </div>
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 border-t border-slate-100 bg-slate-50 flex justify-end">
          <Button
            variant="outline"
            size="sm"
            onClick={() => dispatch(setHealthModalOpen(false))}
          >
            Close
          </Button>
        </div>
      </div>
    </div>
  );
};
