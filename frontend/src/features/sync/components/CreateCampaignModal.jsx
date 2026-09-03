import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client.js';
import { Button } from '../../../components/common/Button.jsx';
import { Badge } from '../../../components/common/Badge.jsx';
import { useDispatch } from 'react-redux';
import { addToast } from '../../../store/slices/notificationSlice.js';
import {
  X,
  Layers,
  Sparkles,
  Calendar,
  Building2,
  Scale,
  Check,
  AlertCircle,
  Play,
} from 'lucide-react';

export const CreateCampaignModal = ({ isOpen, onClose }) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const [name, setName] = useState('');
  const [selectedCourts, setSelectedCourts] = useState([]);
  const [startYear, setStartYear] = useState(2023);
  const [endYear, setEndYear] = useState(2024);
  const [selectedTypes, setSelectedTypes] = useState(['WP', 'CS']);
  const [pagesPerSegment, setPagesPerSegment] = useState(3);

  // Fetch available courts
  const { data: courtsData } = useQuery({
    queryKey: ['courtsListAll'],
    queryFn: async () => {
      const res = await apiClient.get('/api/courts?limit=50');
      return res.data.courts;
    },
    enabled: isOpen,
  });

  // Calculate Segment Math
  const courtsCount = selectedCourts.length;
  const yearsCount = Math.max(0, endYear - startYear + 1);
  const typesCount = selectedTypes.length;
  const totalCalculatedSegments = courtsCount * yearsCount * typesCount;
  const estimatedCases = totalCalculatedSegments * pagesPerSegment * 10;

  const toggleCourt = (id) => {
    setSelectedCourts((prev) =>
      prev.includes(id) ? prev.filter((c) => c !== id) : [...prev, id]
    );
  };

  const toggleType = (type) => {
    setSelectedTypes((prev) =>
      prev.includes(type) ? prev.filter((t) => t !== type) : [...prev, type]
    );
  };

  const createMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/api/backfill/campaigns', {
        name,
        courtIds: selectedCourts,
        startYear,
        endYear,
        caseTypes: selectedTypes,
        totalPagesPerSegment: pagesPerSegment,
      });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['backfillCampaigns'] });
      queryClient.invalidateQueries({ queryKey: ['backfillStats'] });
      dispatch(
        addToast({
          type: 'success',
          title: 'Backfill Campaign Launched',
          message: `Campaign "${name}" initialized with ${data.totalJobs} segmented discovery jobs.`,
        })
      );
      onClose();
    },
    onError: (err) => {
      dispatch(
        addToast({
          type: 'error',
          title: 'Launch Failed',
          message: err.message || 'Could not launch backfill campaign',
        })
      );
    },
  });

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-fadeIn font-sans">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Header */}
        <div className="p-5 border-b border-slate-200 flex items-center justify-between bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shadow-xs">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold text-slate-900">
                Launch Historical Backfill Campaign
              </h2>
              <p className="text-xs text-slate-500">
                Segmented multi-court and multi-year historical ingestion pipeline
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Form Body */}
        <div className="p-6 space-y-5 overflow-y-auto text-xs">
          {/* 1. Campaign Name */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Campaign Name
            </label>
            <input
              type="text"
              placeholder="e.g. Bombay High Court 2020-2024 Comprehensive Backfill"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="w-full text-xs px-3.5 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
            />
          </div>

          {/* 2. Court Selection */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Target Establishments ({selectedCourts.length} selected)
              </label>
              <button
                type="button"
                onClick={() => {
                  if (selectedCourts.length === courtsData?.length) {
                    setSelectedCourts([]);
                  } else {
                    setSelectedCourts(courtsData?.map((c) => c.id) || []);
                  }
                }}
                className="text-[11px] text-blue-600 hover:underline font-semibold"
              >
                {selectedCourts.length === courtsData?.length ? 'Deselect All' : 'Select All'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-36 overflow-y-auto p-2 bg-slate-50 border border-slate-200 rounded-xl">
              {courtsData?.map((c) => {
                const isSelected = selectedCourts.includes(c.id);
                return (
                  <button
                    key={c.id}
                    type="button"
                    onClick={() => toggleCourt(c.id)}
                    className={`p-2 rounded-lg border text-left flex items-start justify-between transition-all ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/70 text-blue-950 font-semibold'
                        : 'border-slate-200 bg-white text-slate-700 hover:border-slate-300'
                    }`}
                  >
                    <div className="truncate mr-2">
                      <div className="truncate text-[11px]">{c.name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">{c.code}</div>
                    </div>
                    {isSelected && <Check className="w-3.5 h-3.5 text-blue-600 shrink-0 mt-0.5" />}
                  </button>
                );
              })}
            </div>
          </div>

          {/* 3. Date / Year Range */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                Start Year
              </label>
              <select
                value={startYear}
                onChange={(e) => setStartYear(parseInt(e.target.value, 10))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-mono focus:ring-2 focus:ring-blue-500"
              >
                {[2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
                End Year
              </label>
              <select
                value={endYear}
                onChange={(e) => setEndYear(parseInt(e.target.value, 10))}
                className="w-full bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 font-mono focus:ring-2 focus:ring-blue-500"
              >
                {[2020, 2021, 2022, 2023, 2024, 2025, 2026].map((y) => (
                  <option key={y} value={y}>
                    {y}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 4. Case Types Selection */}
          <div className="space-y-1.5">
            <label className="font-bold text-slate-700 uppercase tracking-wider text-[11px]">
              Case Types
            </label>
            <div className="flex flex-wrap gap-2">
              {[
                { code: 'WP', label: 'Writ Petition (WP)' },
                { code: 'CS', label: 'Civil Suit (CS)' },
                { code: 'CC', label: 'Criminal Case (CC)' },
                { code: 'BAIL_APPL', label: 'Bail Application' },
                { code: 'ARB_PET', label: 'Arbitration Petition' },
                { code: 'CONT_CAS', label: 'Contempt Case' },
              ].map((t) => {
                const isChecked = selectedTypes.includes(t.code);
                return (
                  <button
                    key={t.code}
                    type="button"
                    onClick={() => toggleType(t.code)}
                    className={`px-3 py-1.5 rounded-lg border text-xs font-medium transition-all ${
                      isChecked
                        ? 'border-blue-600 bg-blue-50 text-blue-800 font-bold'
                        : 'border-slate-200 bg-white text-slate-600 hover:border-slate-300'
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Real-time Cartesian Segment Calculator Banner */}
          <div className="p-4 bg-slate-900 text-white rounded-xl space-y-2">
            <div className="flex items-center justify-between text-xs">
              <span className="font-bold flex items-center gap-1.5 text-blue-400">
                <Sparkles className="w-3.5 h-3.5" />
                Automated Job Segmentation Calculator:
              </span>
              <Badge variant="purple" size="sm">
                {totalCalculatedSegments} Segmented Jobs
              </Badge>
            </div>

            <div className="font-mono text-[11px] text-slate-300 flex items-center gap-2">
              <span>{courtsCount} Courts</span>
              <span>×</span>
              <span>{yearsCount} Years</span>
              <span>×</span>
              <span>{typesCount} Case Types</span>
              <span>=</span>
              <strong className="text-white">{totalCalculatedSegments} BullMQ Jobs</strong>
            </div>

            <p className="text-[10px] text-slate-400">
              Each segment will execute independently with automatic retry policies, rate limit throttling, and auto-queued case detail ingestion.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          <div className="text-[11px] text-slate-500 font-mono">
            Est. ~{estimatedCases} Historical Records
          </div>

          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={onClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              size="sm"
              disabled={!name || !selectedCourts.length || totalCalculatedSegments === 0}
              isLoading={createMutation.isPending}
              onClick={() => createMutation.mutate()}
              leftIcon={<Play className="w-3.5 h-3.5" />}
            >
              Launch Backfill Engine
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
