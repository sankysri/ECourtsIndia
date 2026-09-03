import React from 'react';
import { Card, CardHeader } from '../../../components/common/Card.jsx';
import { Badge } from '../../../components/common/Badge.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { Layers, Play, CheckCircle2, Clock, AlertTriangle } from 'lucide-react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client.js';
import { useDispatch } from 'react-redux';
import { addToast } from '../../../store/slices/notificationSlice.js';

export const QueueStatusWidget = ({ queuesData, isLoading }) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const testJobMutation = useMutation({
    mutationFn: async (queueName) => {
      const res = await apiClient.post('/api/queues/test-job', {
        queueName,
        payload: { source: 'QueueStatusWidget', timestamp: new Date().toISOString() },
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['systemHealth'] });
      queryClient.invalidateQueries({ queryKey: ['dashboardStats'] });
      dispatch(
        addToast({
          type: 'success',
          title: 'Heartbeat Job Dispatched',
          message: `Test job processed for ${data.job?.queue || 'BullMQ queue'}`,
        })
      );
    },
  });

  const queueList = queuesData?.queues || [
    { name: 'courtSyncQueue', status: 'HEALTHY', metrics: { active: 0, completed: 0, failed: 0 } },
    { name: 'caseDiscoveryQueue', status: 'HEALTHY', metrics: { active: 0, completed: 0, failed: 0 } },
    { name: 'caseDetailQueue', status: 'HEALTHY', metrics: { active: 0, completed: 0, failed: 0 } },
    { name: 'caseSyncQueue', status: 'HEALTHY', metrics: { active: 0, completed: 0, failed: 0 } },
    { name: 'documentQueue', status: 'HEALTHY', metrics: { active: 0, completed: 0, failed: 0 } },
    { name: 'indexQueue', status: 'HEALTHY', metrics: { active: 0, completed: 0, failed: 0 } },
  ];

  return (
    <Card>
      <CardHeader
        title="BullMQ Ingestion Queues"
        subtitle="Active pipeline job queues & worker telemetry"
        badge={<Badge variant="navy" size="sm">{queueList.length} Active Queues</Badge>}
        action={
          <Button
            size="sm"
            variant="outline"
            isLoading={testJobMutation.isPending}
            onClick={() => testJobMutation.mutate('caseDiscoveryQueue')}
            leftIcon={<Play className="w-3.5 h-3.5" />}
          >
            Trigger Test Job
          </Button>
        }
      />

      <div className="divide-y divide-slate-100 mt-2">
        {queueList.map((q) => (
          <div
            key={q.name}
            className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2 hover:bg-slate-50/80 px-2 rounded-lg transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5" />
              </div>
              <div>
                <span className="font-mono text-xs font-semibold text-slate-900">{q.name}</span>
                <div className="flex items-center gap-3 text-[11px] text-slate-500 mt-0.5">
                  <span className="flex items-center gap-1">
                    <Clock className="w-3 h-3 text-amber-500" /> Active: {q.metrics?.active || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3 text-emerald-500" /> Completed: {q.metrics?.completed || 0}
                  </span>
                  <span className="flex items-center gap-1">
                    <AlertTriangle className="w-3 h-3 text-rose-500" /> Failed: {q.metrics?.failed || 0}
                  </span>
                </div>
              </div>
            </div>

            <div className="flex items-center gap-2 self-end sm:self-center">
              <Badge variant={q.status === 'HEALTHY' ? 'success' : 'default'} size="sm">
                {q.status}
              </Badge>
              <button
                disabled={testJobMutation.isPending}
                onClick={() => testJobMutation.mutate(q.name)}
                className="text-[11px] px-2 py-1 rounded bg-slate-100 hover:bg-slate-200 text-slate-700 font-medium transition-colors"
                title={`Trigger test heartbeat job for ${q.name}`}
              >
                Test
              </button>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
};
