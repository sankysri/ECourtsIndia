import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client.js';
import { Card, CardHeader } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Activity, Zap, CheckCircle2, RefreshCw, Server, Shield } from 'lucide-react';

export const ApiUsagePage = () => {
  // Query 1: System Settings for dynamic rate limits
  const { data: settingsData, refetch: refetchSettings, isFetching } = useQuery({
    queryKey: ['systemSettings'],
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
  const rateLimitPerHour = settingsData?.find((s) => s.key === 'api_requests_per_hour')?.value || 10000;
  const rateLimitPerDay = settingsData?.find((s) => s.key === 'api_requests_per_day')?.value || 50000;
  const maxConcurrent = settingsData?.find((s) => s.key === 'api_max_concurrent_requests')?.value || 25;

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            eCourts API Gateway & Rate Limit Telemetry
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Dynamic Redis rate limit token bucket, upstream call quotas, and request throttling protection
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <Badge variant="success" size="md" dot>
            Redis Rate Limiter Active
          </Badge>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetchSettings()}
            isLoading={isFetching}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Refresh
          </Button>
        </div>
      </div>

      {/* Dynamic Quotas Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase">Requests / Minute</div>
          <div className="text-2xl font-extrabold font-mono text-slate-900 mt-1">{rateLimitPerMin} reqs</div>
          <div className="text-[11px] text-slate-500 mt-1">Sliding 60s Redis window</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase">Requests / Hour</div>
          <div className="text-2xl font-extrabold font-mono text-blue-600 mt-1">{rateLimitPerHour.toLocaleString()} reqs</div>
          <div className="text-[11px] text-slate-500 mt-1">Sliding 3600s Redis window</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase">Daily Allocation</div>
          <div className="text-2xl font-extrabold font-mono text-emerald-600 mt-1">{rateLimitPerDay.toLocaleString()} reqs</div>
          <div className="text-[11px] text-slate-500 mt-1">24-hour quota envelope</div>
        </Card>

        <Card className="p-4">
          <div className="text-xs font-semibold text-slate-500 uppercase">Max Concurrency</div>
          <div className="text-2xl font-extrabold font-mono text-purple-600 mt-1">{maxConcurrent} In-Flight</div>
          <div className="text-[11px] text-emerald-600 font-semibold mt-1">Automatic backoff enabled</div>
        </Card>
      </div>

      {/* Upstream Endpoint Catalog */}
      <Card>
        <CardHeader
          title="Integrated eCourts API Services"
          subtitle="All upstream calls pass through ecourtsIndiaClient with retry backoff, timeout, and logging"
          badge={<Badge variant="navy" size="sm">Central Client</Badge>}
        />

        <div className="divide-y divide-slate-100 text-xs">
          <div className="py-3 px-2 flex items-center justify-between">
            <div>
              <span className="font-mono font-bold text-slate-900">GET /courts/hierarchy</span>
              <p className="text-slate-500 text-[11px] mt-0.5">Court hierarchy master & jurisdictional tree</p>
            </div>
            <Badge variant="success" size="sm">Active (Court Master)</Badge>
          </div>

          <div className="py-3 px-2 flex items-center justify-between">
            <div>
              <span className="font-mono font-bold text-slate-900">GET /meta/enums</span>
              <p className="text-slate-500 text-[11px] mt-0.5">Dynamic reference enums (case types, statuses, court types)</p>
            </div>
            <Badge variant="success" size="sm">Active (Capabilities)</Badge>
          </div>

          <div className="py-3 px-2 flex items-center justify-between">
            <div>
              <span className="font-mono font-bold text-slate-900">POST /cases/search/discover</span>
              <p className="text-slate-500 text-[11px] mt-0.5">Case discovery query with pagination and filter extraction</p>
            </div>
            <Badge variant="success" size="sm">Active (Discovery Engine)</Badge>
          </div>

          <div className="py-3 px-2 flex items-center justify-between">
            <div>
              <span className="font-mono font-bold text-slate-900">GET /cases/detail/:cnr</span>
              <p className="text-slate-500 text-[11px] mt-0.5">Full docket proceedings, hearings, orders, and parties</p>
            </div>
            <Badge variant="success" size="sm">Active (Detail Ingestion)</Badge>
          </div>
        </div>
      </Card>
    </div>
  );
};
