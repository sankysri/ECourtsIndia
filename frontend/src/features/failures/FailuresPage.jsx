import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client.js';
import { Card, CardHeader } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { AlertTriangle, CheckCircle2, RefreshCw, ShieldCheck, Activity } from 'lucide-react';

export const FailuresPage = () => {
  const { data: healthData, isLoading, refetch, isFetching } = useQuery({
    queryKey: ['failuresQueueHealth'],
    queryFn: async () => {
      const res = await apiClient.get('/api/dashboard/system-health');
      return res.data;
    },
    refetchInterval: 5000,
  });

  const queues = healthData?.services?.queues?.queues || [];
  const totalFailed = healthData?.services?.queues?.telemetry?.totalFailed || 0;
  const queuesWithFailures = queues.filter((q) => q.metrics?.failed > 0);

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Sync Failures & Dead Letter Queue (DLQ)
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Inspection, exponential backoff retries, and error diagnosis for failed ingestion jobs
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Badge variant={totalFailed === 0 ? 'success' : 'error'} size="md">
            {totalFailed === 0 ? '0 Critical Failures' : `${totalFailed} Failed Jobs`}
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            isLoading={isFetching}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Overview */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase">Dead Letter Jobs</div>
          <div className={`text-2xl font-extrabold font-mono mt-1 ${totalFailed === 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
            {totalFailed}
          </div>
          <div className="text-[11px] text-slate-500 mt-1">
            {totalFailed === 0 ? 'No unrecoverable errors' : 'Requires worker diagnosis'}
          </div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase">Auto-Retry Strategy</div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1">Exponential</div>
          <div className="text-[11px] text-slate-500 mt-1">3 Attempts (2s backoff)</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase">Active Monitored Queues</div>
          <div className="text-2xl font-extrabold font-mono text-blue-600 mt-1">{queues.length} Queues</div>
          <div className="text-[11px] text-slate-500 mt-1">BullMQ Redis instances</div>
        </Card>
      </div>

      {/* Failures Breakdown or Empty State */}
      {totalFailed === 0 ? (
        <EmptyState
          icon={CheckCircle2}
          title="Zero Job Failures"
          description="All BullMQ queue workers and database write operations are executing cleanly with zero dead-letter queue records."
        />
      ) : (
        <Card>
          <CardHeader
            title="Failed Queue Execution Records"
            subtitle="Review failed queue jobs for retry"
            badge={<Badge variant="error" size="sm">Action Required</Badge>}
          />
          <div className="divide-y divide-slate-100">
            {queuesWithFailures.map((q) => (
              <div key={q.name} className="py-3 px-4 flex items-center justify-between">
                <div>
                  <span className="font-mono font-bold text-xs text-slate-900">{q.name}</span>
                  <p className="text-xs text-slate-500 mt-0.5">Status: {q.status}</p>
                </div>
                <Badge variant="error" size="sm">
                  {q.metrics?.failed} Failed
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
};
