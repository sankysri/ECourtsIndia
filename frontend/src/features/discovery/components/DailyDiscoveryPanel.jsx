import React, { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client.js';
import { Card } from '../../../components/common/Card.jsx';
import { Badge } from '../../../components/common/Badge.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { DailyConfigModal } from './DailyConfigModal.jsx';
import { PermissionGuard } from '../../../components/common/PermissionGuard.jsx';
import { PERMISSIONS } from '../../../constants/permissions.js';
import {
  Sparkles,
  Calendar,
  Clock,
  Play,
  Settings,
  RefreshCw,
  CheckCircle2,
  AlertCircle,
  Layers,
  Activity,
  ShieldCheck,
} from 'lucide-react';

export const DailyDiscoveryPanel = ({ config, onTriggerSuccess }) => {
  const queryClient = useQueryClient();
  const [configModalOpen, setConfigModalOpen] = useState(false);
  const [feedback, setFeedback] = useState(null);

  const triggerMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/api/discovery/daily/trigger');
      return res.data;
    },
    onSuccess: (data) => {
      setFeedback({ type: 'success', message: `Dispatched daily discovery run across ${data.data?.jobsCount || 0} courts!` });
      queryClient.invalidateQueries({ queryKey: ['dailyDiscoveryStatus'] });
      queryClient.invalidateQueries({ queryKey: ['dailyDiscoveryHistory'] });
      queryClient.invalidateQueries({ queryKey: ['discoveryJobs'] });
      queryClient.invalidateQueries({ queryKey: ['discoveryStats'] });
      if (onTriggerSuccess) onTriggerSuccess();
      setTimeout(() => setFeedback(null), 5000);
    },
    onError: (err) => {
      setFeedback({ type: 'error', message: err.response?.data?.message || err.message || 'Failed to trigger discovery run' });
      setTimeout(() => setFeedback(null), 6000);
    },
  });

  const enabled = config?.enabled ?? true;
  const lookback = config?.lookbackWindow || 'LAST_7_DAYS';
  const lastRun = config?.lastRun;
  const nextRunAt = config?.nextRunAt;

  const getWindowBadge = (w) => {
    switch (w) {
      case 'TODAY':
        return 'Today (0d lookback)';
      case 'YESTERDAY':
        return 'Yesterday (24h lookback)';
      case 'LAST_7_DAYS':
        return 'Last 7 Days (Overlapping)';
      case 'LAST_30_DAYS':
        return 'Last 30 Days (Extended)';
      default:
        return w;
    }
  };

  return (
    <Card className="p-5 border-slate-200 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shadow-lg overflow-hidden relative font-sans">
      {/* Background glow element */}
      <div className="absolute top-0 right-0 w-96 h-96 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -mr-20 -mt-20"></div>

      <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
        {/* Left Info Column */}
        <div className="space-y-2">
          <div className="flex items-center gap-2.5">
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[11px] font-bold bg-blue-500/20 text-blue-300 border border-blue-400/30">
              <Sparkles className="w-3 h-3 text-blue-400" />
              Daily Case Discovery Engine
            </span>
            {enabled ? (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
                ACTIVE SCHEDULED
              </span>
            ) : (
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-slate-500/20 text-slate-300 border border-slate-500/30">
                DISABLED
              </span>
            )}
          </div>

          <h2 className="text-base sm:text-lg font-extrabold text-white tracking-tight">
            Automated Incremental Case Ingestion
          </h2>
          <p className="text-xs text-slate-300 max-w-xl leading-relaxed">
            Continuously queries all active court complexes with overlapping lookback windows to capture new filings and delayed dockets, automatically enqueuing full case dossiers.
          </p>

          {/* Configuration Summary Pills */}
          <div className="flex flex-wrap items-center gap-3 pt-1 text-xs">
            <div className="flex items-center gap-1.5 text-slate-300">
              <Calendar className="w-3.5 h-3.5 text-blue-400" />
              <span>Window:</span>
              <span className="font-semibold text-white bg-white/10 px-2 py-0.5 rounded text-[11px]">
                {getWindowBadge(lookback)}
              </span>
            </div>

            <div className="flex items-center gap-1.5 text-slate-300">
              <Clock className="w-3.5 h-3.5 text-emerald-400" />
              <span>Next Scheduled Run:</span>
              <span className="font-semibold text-emerald-300">
                {nextRunAt ? new Date(nextRunAt).toLocaleDateString() + ' at 02:00 AM' : 'Daily at 02:00 AM'}
              </span>
            </div>

            {lastRun && (
              <div className="flex items-center gap-1.5 text-slate-300">
                <CheckCircle2 className="w-3.5 h-3.5 text-purple-400" />
                <span>Last Discovered:</span>
                <span className="font-mono font-bold text-purple-300">
                  +{lastRun.new_cnrs_found || 0} new CNRs ({lastRun.courts_scanned || 0} courts)
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right Action Column */}
        <PermissionGuard permission={PERMISSIONS.START_DISCOVERY}>
          <div className="flex flex-col sm:flex-row md:flex-col items-start md:items-end gap-2.5 shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setConfigModalOpen(true)}
                className="px-3 py-2 rounded-xl text-xs font-bold bg-white/10 hover:bg-white/15 text-slate-200 border border-white/10 transition-all flex items-center gap-1.5 shadow-sm"
              >
                <Settings className="w-3.5 h-3.5" />
                Settings
              </button>

              <button
                onClick={() => triggerMutation.mutate()}
                disabled={triggerMutation.isPending}
                className="px-4 py-2 rounded-xl text-xs font-bold bg-blue-600 hover:bg-blue-500 text-white shadow-md transition-all flex items-center gap-1.5 disabled:opacity-50"
              >
                {triggerMutation.isPending ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    Dispatching...
                  </>
                ) : (
                  <>
                    <Play className="w-3.5 h-3.5 fill-current" />
                    Run Daily Discovery Now
                  </>
                )}
              </button>
            </div>

            {feedback && (
              <div
                className={`p-2 rounded-lg text-[11px] font-semibold flex items-center gap-1.5 animate-fadeIn ${
                  feedback.type === 'success'
                    ? 'bg-emerald-500/20 border border-emerald-500/40 text-emerald-300'
                    : 'bg-rose-500/20 border border-rose-500/40 text-rose-300'
                }`}
              >
                {feedback.type === 'success' ? (
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                ) : (
                  <AlertCircle className="w-3.5 h-3.5 text-rose-400 shrink-0" />
                )}
                <span>{feedback.message}</span>
              </div>
            )}
          </div>
        </PermissionGuard>
      </div>

      <DailyConfigModal
        isOpen={configModalOpen}
        onClose={() => setConfigModalOpen(false)}
        currentConfig={config}
      />
    </Card>
  );
};
