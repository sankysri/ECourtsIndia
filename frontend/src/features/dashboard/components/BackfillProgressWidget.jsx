import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/client.js';
import { Card, CardHeader } from '../../../components/common/Card.jsx';
import { Badge } from '../../../components/common/Badge.jsx';
import { RefreshCw, Database, CheckCircle, Clock } from 'lucide-react';

export const BackfillProgressWidget = () => {
  const { data: backfillData } = useQuery({
    queryKey: ['dashboardBackfills'],
    queryFn: async () => {
      try {
        const res = await apiClient.get('/api/backfill/campaigns?limit=4');
        return res.data.campaigns || [];
      } catch {
        return [];
      }
    },
    refetchInterval: 5000,
  });

  const campaigns = backfillData || [];

  return (
    <Card>
      <CardHeader
        title="Historical Backfill Pipeline"
        subtitle="Active campaigns and ingestion progress"
        badge={<Badge variant="navy" size="sm">{campaigns.length} Campaigns</Badge>}
      />

      <div className="space-y-3 my-2">
        {campaigns.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No backfill campaigns active. Start one from the Sync Center.
          </div>
        ) : (
          campaigns.map((camp) => {
            const total = camp.total_jobs || 1;
            const completed = camp.completed_jobs || 0;
            const percent = Math.min(100, Math.round((completed / total) * 100));

            return (
              <div key={camp.id} className="p-3 bg-slate-50/70 rounded-xl border border-slate-200/80">
                <div className="flex items-center justify-between text-xs mb-1.5">
                  <span className="font-semibold text-slate-800 truncate mr-2">
                    {camp.name}
                  </span>
                  <span className="font-mono text-[11px] text-slate-500 shrink-0">
                    {completed}/{total} Jobs
                  </span>
                </div>

                <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden mb-2">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      camp.status === 'COMPLETED' ? 'bg-emerald-500' : 'bg-blue-600'
                    }`}
                    style={{ width: `${percent}%` }}
                  />
                </div>

                <div className="flex items-center justify-between text-[11px] text-slate-500">
                  <span className="flex items-center gap-1">
                    {camp.status === 'COMPLETED' ? (
                      <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
                    ) : (
                      <RefreshCw className="w-3.5 h-3.5 text-blue-500 animate-spin" />
                    )}
                    Status: {camp.status}
                  </span>
                  <span className="font-mono font-medium text-slate-700">
                    {camp.total_cases_found ? `${camp.total_cases_found} CNRs` : `${percent}%`}
                  </span>
                </div>
              </div>
            );
          })
        )}
      </div>
    </Card>
  );
};
