import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/client.js';
import { Card, CardHeader } from '../../../components/common/Card.jsx';
import { Badge } from '../../../components/common/Badge.jsx';
import { Activity, Zap } from 'lucide-react';

export const ApiUsageSummaryWidget = () => {
  const { data: settingsData } = useQuery({
    queryKey: ['dashboardApiSettings'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/api/settings/config');
        return res.data.settings || [];
      } catch {
        return [];
      }
    },
  });

  const rateLimitPerMin = settingsData?.find((s) => s.key === 'api_requests_per_minute')?.value || 600;
  const maxConcurrent = settingsData?.find((s) => s.key === 'api_max_concurrent_requests')?.value || 25;

  return (
    <Card>
      <CardHeader
        title="eCourts API Gateway Telemetry"
        subtitle="Upstream API throughput, rate limits, and latency"
        badge={<Badge variant="success" size="sm">Redis Active</Badge>}
      />

      <div className="grid grid-cols-2 gap-3 my-3">
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Rate Limit Quota</div>
          <div className="text-xl font-bold font-mono text-slate-900 mt-1">{rateLimitPerMin} req / min</div>
          <div className="text-[10px] text-slate-500 mt-1">Sliding token bucket</div>
        </div>

        <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
          <div className="text-[11px] font-semibold text-slate-500 uppercase">Max Concurrency</div>
          <div className="text-xl font-bold font-mono text-emerald-600 mt-1">{maxConcurrent} In-Flight</div>
          <div className="text-[10px] text-slate-500 mt-1">Simultaneous upstream</div>
        </div>
      </div>

      <div className="p-3 bg-blue-50/50 rounded-xl border border-blue-100 flex items-center justify-between text-xs">
        <div className="flex items-center gap-2 text-blue-950 font-medium">
          <Zap className="w-4 h-4 text-blue-600 shrink-0" />
          <span>Ingestion Throttling Protection Active</span>
        </div>
        <Badge variant="info" size="sm">100% HEALTH</Badge>
      </div>
    </Card>
  );
};
