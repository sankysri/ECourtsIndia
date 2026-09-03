import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client.js';
import { Button } from '../../../components/common/Button.jsx';
import {
  Settings,
  Calendar,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  X,
  Sliders,
  ShieldCheck,
} from 'lucide-react';

export const DailyConfigModal = ({ isOpen, onClose, currentConfig }) => {
  const queryClient = useQueryClient();
  const [enabled, setEnabled] = useState(true);
  const [lookbackWindow, setLookbackWindow] = useState('LAST_7_DAYS');
  const [maxJobsPerRun, setMaxJobsPerRun] = useState(20);
  const [cron, setCron] = useState('0 2 * * *');
  const [activeCourtsOnly, setActiveCourtsOnly] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (currentConfig) {
      setEnabled(currentConfig.enabled ?? true);
      setLookbackWindow(currentConfig.lookbackWindow || 'LAST_7_DAYS');
      setMaxJobsPerRun(currentConfig.maxJobsPerRun || 20);
      setCron(currentConfig.cron || '0 2 * * *');
      setActiveCourtsOnly(currentConfig.activeCourtsOnly ?? true);
    }
  }, [currentConfig]);

  const updateMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await apiClient.put('/api/discovery/daily/config', payload);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['dailyDiscoveryStatus'] });
      onClose();
    },
    onError: (err) => {
      setError(err.response?.data?.message || err.message || 'Failed to update configuration');
    },
  });

  if (!isOpen) return null;

  const handleSubmit = (e) => {
    e.preventDefault();
    setError(null);
    updateMutation.mutate({
      enabled,
      lookbackWindow,
      maxJobsPerRun: Number(maxJobsPerRun),
      cron,
      activeCourtsOnly,
    });
  };

  const windows = [
    { code: 'TODAY', label: 'Today', desc: 'Scan same-day filings (0 day lookback)' },
    { code: 'YESTERDAY', label: 'Yesterday', desc: 'Scan 24-hour lookback window' },
    { code: 'LAST_7_DAYS', label: 'Last 7 Days', desc: 'Recommended overlapping window to prevent missing delayed dockets' },
    { code: 'LAST_30_DAYS', label: 'Last 30 Days', desc: 'Extended 1-month comprehensive search window' },
  ];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn font-sans">
      <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-scaleIn">
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center font-bold">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <h2 className="text-sm font-bold text-slate-900">Daily Discovery Settings</h2>
              <p className="text-[11px] text-slate-500">Configure automated incremental crawler and lookback windows</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-200/50 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-5">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-700 rounded-xl text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          {/* Enabled Toggle */}
          <div className="flex items-center justify-between p-3.5 bg-slate-50 border border-slate-200 rounded-xl">
            <div>
              <span className="text-xs font-bold text-slate-900 block">Automatic Scheduler</span>
              <span className="text-[11px] text-slate-500 block">Run scheduled incremental case discovery daily</span>
            </div>
            <label className="relative inline-flex items-center cursor-pointer">
              <input
                type="checkbox"
                checked={enabled}
                onChange={(e) => setEnabled(e.target.checked)}
                className="sr-only peer"
              />
              <div className="w-11 h-6 bg-slate-300 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-slate-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-blue-600"></div>
            </label>
          </div>

          {/* Overlapping Lookback Window Selection */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
              <Calendar className="w-3.5 h-3.5 text-blue-600" />
              Overlapping Lookback Window
            </label>
            <div className="grid grid-cols-1 gap-2">
              {windows.map((w) => (
                <div
                  key={w.code}
                  onClick={() => setLookbackWindow(w.code)}
                  className={`p-3 rounded-xl border cursor-pointer transition-all flex items-center justify-between ${
                    lookbackWindow === w.code
                      ? 'border-blue-600 bg-blue-50/50 text-blue-900 shadow-sm'
                      : 'border-slate-200 hover:border-slate-300 bg-white'
                  }`}
                >
                  <div>
                    <span className="text-xs font-bold block">{w.label}</span>
                    <span className="text-[11px] text-slate-500 block">{w.desc}</span>
                  </div>
                  {lookbackWindow === w.code && <CheckCircle2 className="w-4 h-4 text-blue-600 shrink-0" />}
                </div>
              ))}
            </div>
          </div>

          {/* Max Jobs & Active Courts Filter */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Max Courts / Run</label>
              <input
                type="number"
                min="1"
                max="100"
                value={maxJobsPerRun}
                onChange={(e) => setMaxJobsPerRun(e.target.value)}
                className="w-full px-3 py-2 text-xs border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-slate-700">Schedule Time (Cron)</label>
              <input
                type="text"
                value={cron}
                onChange={(e) => setCron(e.target.value)}
                placeholder="0 2 * * *"
                className="w-full px-3 py-2 text-xs font-mono border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500/20 focus:border-blue-500"
              />
            </div>
          </div>

          {/* Modal Footer Actions */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end gap-2.5">
            <Button variant="outline" size="sm" type="button" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              type="submit"
              disabled={updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save Configuration'}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
};
