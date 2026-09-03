import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/client.js';
import { Badge } from '../../../components/common/Badge.jsx';
import { Button } from '../../../components/common/Button.jsx';
import {
  X,
  Layers,
  Calendar,
  Building2,
  RefreshCw,
  CheckCircle2,
  AlertTriangle,
  Clock,
  Ban,
  Pause,
} from 'lucide-react';

export const CampaignSegmentsDrawer = ({ campaignId, onClose }) => {
  const { data: campaignData, isLoading, refetch } = useQuery({
    queryKey: ['campaignSegments', campaignId],
    queryFn: async () => {
      const res = await apiClient.get(`/api/backfill/campaigns/${campaignId}`);
      return res.data.campaign;
    },
    enabled: !!campaignId,
    refetchInterval: 3000,
  });

  if (!campaignId) return null;

  const campaign = campaignData;
  const segments = campaign?.segments || [];

  return (
    <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-fadeIn font-sans">
      <div className="bg-white w-full max-w-2xl h-full shadow-2xl flex flex-col border-l border-slate-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="w-5 h-5 text-blue-600" />
              <h2 className="text-base font-bold text-slate-900 truncate max-w-md">
                {campaign?.name || 'Campaign Segments'}
              </h2>
            </div>
            <div className="flex items-center gap-3 text-xs text-slate-500 mt-1">
              <span>{segments.length} Segmented Discovery Jobs</span>
              <span>•</span>
              <span className="font-mono">{campaign?.start_date} to {campaign?.end_date}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="xs" onClick={() => refetch()} leftIcon={<RefreshCw className="w-3 h-3" />}>
              Refresh
            </Button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Segments List */}
        <div className="p-5 space-y-3 overflow-y-auto flex-1 text-xs">
          {isLoading ? (
            <div className="py-12 text-center text-slate-400">Loading campaign segments...</div>
          ) : !segments.length ? (
            <div className="py-12 text-center text-slate-400">No segmented jobs found for this campaign.</div>
          ) : (
            segments.map((seg) => {
              const filters = seg.filters || {};
              return (
                <div
                  key={seg.id}
                  className="p-3.5 bg-slate-50 border border-slate-200/80 rounded-xl space-y-2 hover:bg-white hover:border-blue-200 transition-all shadow-2xs"
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-slate-900">{seg.court_name || 'Court'}</span>
                      <Badge variant="navy" size="xs">{filters.caseType || 'WP'}</Badge>
                      <Badge variant="purple" size="xs">{filters.filingYear || 'Year'}</Badge>
                    </div>

                    <Badge
                      variant={
                        seg.status === 'COMPLETED'
                          ? 'success'
                          : seg.status === 'RUNNING'
                          ? 'info'
                          : seg.status === 'FAILED'
                          ? 'danger'
                          : seg.status === 'PAUSED'
                          ? 'warning'
                          : 'default'
                      }
                      size="xs"
                      dot
                    >
                      {seg.status}
                    </Badge>
                  </div>

                  {/* Progress Bar & Pages */}
                  <div className="space-y-1">
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>Page Progress: {seg.current_page} / {seg.total_pages}</span>
                      <span className="font-mono font-semibold text-blue-700">
                        {seg.records_found || 0} Cases ({seg.new_cases_found || 0} new CNRs)
                      </span>
                    </div>

                    <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-blue-600 transition-all"
                        style={{
                          width: `${Math.min(100, Math.round((seg.current_page / seg.total_pages) * 100))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {seg.error_message && (
                    <div className="p-2 bg-rose-50 text-rose-700 rounded-lg text-[10px] font-mono border border-rose-200">
                      Error: {seg.error_message}
                    </div>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
