import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../../api/client.js';
import { useDispatch } from 'react-redux';
import { addToast } from '../../../store/slices/notificationSlice.js';
import {
  Compass,
  X,
  Building2,
  Filter,
  Layers,
  CheckCircle2,
  ArrowRight,
  ArrowLeft,
  Sparkles,
  Calendar,
  Search,
  Zap,
} from 'lucide-react';
import { Button } from '../../../components/common/Button.jsx';
import { Badge } from '../../../components/common/Badge.jsx';

export const CreateDiscoveryWizard = ({ isOpen, onClose, onJobCreated }) => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const [currentStep, setCurrentStep] = useState(1);

  // Form State
  const [selectedState, setSelectedState] = useState('');
  const [selectedCourtId, setSelectedCourtId] = useState('');
  const [courtSearch, setCourtSearch] = useState('');

  const [filingYear, setFilingYear] = useState(2024);
  const [caseType, setCaseType] = useState('WP');
  const [partyName, setPartyName] = useState('');
  const [advocateName, setAdvocateName] = useState('');
  const [caseStatus, setCaseStatus] = useState('');

  const [strategy, setStrategy] = useState('SINGLE'); // 'SINGLE' | 'HISTORICAL_BACKFILL' | 'INCREMENTAL'
  const [customTotalPages, setCustomTotalPages] = useState(3);

  // 1. Fetch Discovery Metadata & Dynamic Enums
  const { data: filterMeta } = useQuery({
    queryKey: ['discoveryFiltersMeta'],
    queryFn: async () => {
      const res = await apiClient.get('/api/discovery/filters');
      return res.data;
    },
    enabled: isOpen,
    staleTime: 60000,
  });

  // 2. Fetch Courts for Step 1
  const { data: courtsData } = useQuery({
    queryKey: ['discoveryCourtsList', selectedState, courtSearch],
    queryFn: async () => {
      const params = new URLSearchParams({
        state: selectedState,
        search: courtSearch,
        limit: '50',
      });
      const res = await apiClient.get(`/api/courts?${params.toString()}`);
      return res.data.courts;
    },
    enabled: isOpen,
  });

  // Create Job Mutation
  const createJobMutation = useMutation({
    mutationFn: async (payload) => {
      const res = await apiClient.post('/api/discovery/jobs', payload);
      return res.data.job;
    },
    onSuccess: (job) => {
      queryClient.invalidateQueries({ queryKey: ['discoveryJobs'] });
      queryClient.invalidateQueries({ queryKey: ['discoveryStats'] });
      dispatch(
        addToast({
          type: 'success',
          title: 'Discovery Job Started',
          message: `Dispatched ${strategy} discovery for target court.`,
        })
      );
      if (onJobCreated) onJobCreated(job);
      handleClose();
    },
    onError: (err) => {
      dispatch(
        addToast({
          type: 'error',
          title: 'Job Dispatch Failed',
          message: err.message || 'Could not create discovery job',
        })
      );
    },
  });

  const handleClose = () => {
    setCurrentStep(1);
    setSelectedState('');
    setSelectedCourtId('');
    setCourtSearch('');
    setPartyName('');
    setAdvocateName('');
    setStrategy('SINGLE');
    onClose();
  };

  const handleStartDiscovery = () => {
    if (!selectedCourtId) {
      dispatch(addToast({ type: 'warning', title: 'Court Required', message: 'Please select a court establishment.' }));
      setCurrentStep(1);
      return;
    }

    createJobMutation.mutate({
      courtId: selectedCourtId,
      strategy,
      filters: {
        filingYear: parseInt(filingYear, 10),
        caseType,
        partyName: partyName.trim() || undefined,
        advocateName: advocateName.trim() || undefined,
        caseStatus: caseStatus || undefined,
        customTotalPages: strategy === 'HISTORICAL_BACKFILL' ? 5 : strategy === 'INCREMENTAL' ? 2 : parseInt(customTotalPages, 10),
      },
    });
  };

  if (!isOpen) return null;

  const states = filterMeta?.states || [];
  const caseTypes = filterMeta?.caseTypes || [];
  const strategies = filterMeta?.strategies || [
    { code: 'SINGLE', label: 'Single Search Query', description: 'Discovers case filings for targeted criteria within 1-3 result pages.', estimatedVolume: '10 - 30 CNRs' },
    { code: 'HISTORICAL_BACKFILL', label: 'Historical Year Backfill', description: 'Iterative multi-page discovery traversing historical annual filings across all case categories.', estimatedVolume: '50 - 200 CNRs' },
    { code: 'INCREMENTAL', label: 'Incremental Recent Filings', description: 'Rapid crawler targeting current active year and newly logged judicial dockets.', estimatedVolume: '10 - 20 CNRs' },
  ];

  const selectedCourt = courtsData?.find((c) => c.id === selectedCourtId);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn font-sans">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-2xl w-full overflow-hidden flex flex-col max-h-[90vh]">
        {/* Wizard Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl bg-blue-100 text-blue-700 flex items-center justify-center">
              <Compass className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">New Case Discovery Wizard</h3>
              <p className="text-xs text-slate-500">Systematic eCourts CNR discovery & docket registry ingestion</p>
            </div>
          </div>
          <button
            onClick={handleClose}
            className="p-1.5 text-slate-400 hover:text-slate-700 rounded-lg hover:bg-slate-200/60 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Step Indicator Bar */}
        <div className="px-6 py-3 bg-slate-100/60 border-b border-slate-200 flex items-center justify-between text-xs font-semibold">
          <div className="flex items-center gap-2">
            {[1, 2, 3, 4].map((step) => (
              <div key={step} className="flex items-center gap-2">
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold ${
                    currentStep === step
                      ? 'bg-blue-600 text-white shadow-xs'
                      : currentStep > step
                      ? 'bg-emerald-500 text-white'
                      : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {currentStep > step ? <CheckCircle2 className="w-3.5 h-3.5" /> : step}
                </div>
                <span className={currentStep === step ? 'text-slate-900 font-bold' : 'text-slate-500'}>
                  {step === 1 ? 'Target Court' : step === 2 ? 'Search Filters' : step === 3 ? 'Strategy' : 'Review & Start'}
                </span>
                {step < 4 && <span className="text-slate-300 font-mono">→</span>}
              </div>
            ))}
          </div>
        </div>

        {/* Wizard Body (Scrollable) */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* STEP 1: SELECT COURT */}
          {currentStep === 1 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">Step 1: Select Target Court Establishment</h4>
                <p className="text-slate-500 text-xs">
                  Choose the High Court, District Court, or Subordinate Bench to execute discovery against.
                </p>
              </div>

              {/* State Filter & Search */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">State / UT</label>
                  <select
                    value={selectedState}
                    onChange={(e) => setSelectedState(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">All States ({states.length})</option>
                    {states.map((s) => (
                      <option key={s.code} value={s.code}>
                        {s.name} ({s.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Search Establishment</label>
                  <div className="relative">
                    <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
                    <input
                      type="text"
                      placeholder="Filter by court name or code..."
                      value={courtSearch}
                      onChange={(e) => setCourtSearch(e.target.value)}
                      className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500"
                    />
                  </div>
                </div>
              </div>

              {/* Courts List Select */}
              <div className="border border-slate-200 rounded-xl overflow-hidden max-h-56 overflow-y-auto divide-y divide-slate-100">
                {!courtsData?.length ? (
                  <div className="p-6 text-center text-slate-400">No courts matched criteria.</div>
                ) : (
                  courtsData.map((court) => (
                    <div
                      key={court.id}
                      onClick={() => setSelectedCourtId(court.id)}
                      className={`p-3 flex items-center justify-between cursor-pointer transition-colors ${
                        selectedCourtId === court.id
                          ? 'bg-blue-50/80 border-l-4 border-blue-600 font-semibold'
                          : 'hover:bg-slate-50'
                      }`}
                    >
                      <div className="flex items-center gap-2.5">
                        <Building2 className={`w-4 h-4 ${selectedCourtId === court.id ? 'text-blue-600' : 'text-slate-400'}`} />
                        <div>
                          <div className="text-slate-900 font-medium">{court.name}</div>
                          <div className="text-[10px] text-slate-400 font-mono">
                            {court.code} • {court.state_name} {court.district_name ? `• ${court.district_name}` : ''}
                          </div>
                        </div>
                      </div>
                      <Badge variant={court.type === 'HIGH_COURT' ? 'purple' : 'default'} size="sm">
                        {court.type.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}

          {/* STEP 2: DYNAMIC SEARCH FILTERS */}
          {currentStep === 2 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">Step 2: Dynamic Search & Discovery Filters</h4>
                <p className="text-slate-500 text-xs">
                  Configure search query parameters dynamically synchronized from upstream eCourts capabilities.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Filing Year</label>
                  <select
                    value={filingYear}
                    onChange={(e) => setFilingYear(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500 font-mono"
                  >
                    {[2026, 2025, 2024, 2023, 2022, 2021, 2020, 2019, 2018].map((y) => (
                      <option key={y} value={y}>
                        {y}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Case Type</label>
                  <select
                    value={caseType}
                    onChange={(e) => setCaseType(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500"
                  >
                    {caseTypes.map((ct) => (
                      <option key={ct.code} value={ct.code}>
                        {ct.label} ({ct.code})
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Party / Petitioner Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. State of Maharashtra, Tata, Sharma..."
                    value={partyName}
                    onChange={(e) => setPartyName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="block text-[11px] font-bold text-slate-700 uppercase mb-1">Advocate Name (Optional)</label>
                  <input
                    type="text"
                    placeholder="e.g. Adv. K. Parasaran..."
                    value={advocateName}
                    onChange={(e) => setAdvocateName(e.target.value)}
                    className="w-full bg-slate-50 border border-slate-200 rounded-lg p-2.5 text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-center gap-2 text-[11px] text-blue-900">
                <Sparkles className="w-4 h-4 text-blue-600 shrink-0" />
                <span>Filters match official eCourts India developer search endpoints. Empty parameters search entire case type.</span>
              </div>
            </div>
          )}

          {/* STEP 3: SELECT STRATEGY */}
          {currentStep === 3 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">Step 3: Choose Ingestion Strategy</h4>
                <p className="text-slate-500 text-xs">
                  Select how the crawler traverses results and schedules BullMQ background workers.
                </p>
              </div>

              <div className="space-y-3">
                {strategies.map((strat) => (
                  <div
                    key={strat.code}
                    onClick={() => setStrategy(strat.code)}
                    className={`p-4 rounded-xl border cursor-pointer transition-all ${
                      strategy === strat.code
                        ? 'bg-blue-50/60 border-blue-500 ring-2 ring-blue-500/20 shadow-xs'
                        : 'bg-white border-slate-200 hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="font-bold text-slate-900 text-sm flex items-center gap-2">
                        <div
                          className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                            strategy === strat.code ? 'border-blue-600 bg-blue-600' : 'border-slate-300'
                          }`}
                        >
                          {strategy === strat.code && <div className="w-1.5 h-1.5 bg-white rounded-full" />}
                        </div>
                        {strat.label}
                      </div>
                      <Badge variant="navy" size="sm">{strat.estimatedVolume}</Badge>
                    </div>
                    <p className="text-slate-600 text-xs mt-2 pl-6 leading-relaxed">
                      {strat.description}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* STEP 4: REVIEW & START */}
          {currentStep === 4 && (
            <div className="space-y-4">
              <div className="space-y-1">
                <h4 className="font-bold text-slate-900 text-sm">Step 4: Review Discovery Job Parameters</h4>
                <p className="text-slate-500 text-xs">
                  Confirm target establishment and crawler parameters before dispatching to BullMQ.
                </p>
              </div>

              <div className="bg-slate-50 rounded-xl border border-slate-200 p-4 space-y-3">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Target Court:</span>
                  <span className="font-bold text-slate-900">{selectedCourt?.name || 'Selected Court'}</span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Court Code & Jurisdiction:</span>
                  <span className="font-mono text-slate-800">{selectedCourt?.code} ({selectedCourt?.state_name})</span>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Strategy:</span>
                  <Badge variant="navy" size="sm">{strategy}</Badge>
                </div>

                <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Filing Year / Case Type:</span>
                  <span className="font-mono font-bold text-slate-800">{filingYear} • {caseType}</span>
                </div>

                {partyName && (
                  <div className="flex items-center justify-between pb-2 border-b border-slate-200/80">
                    <span className="text-slate-500 font-semibold uppercase text-[10px]">Party Name Filter:</span>
                    <span className="text-slate-800 font-medium">{partyName}</span>
                  </div>
                )}

                <div className="flex items-center justify-between">
                  <span className="text-slate-500 font-semibold uppercase text-[10px]">Idempotency Guard:</span>
                  <span className="text-emerald-700 font-semibold flex items-center gap-1">
                    <CheckCircle2 className="w-3.5 h-3.5" /> Deduplication Active
                  </span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Wizard Footer */}
        <div className="px-6 py-4 border-t border-slate-100 bg-slate-50/70 flex items-center justify-between">
          {currentStep > 1 ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setCurrentStep((s) => Math.max(s - 1, 1))}
              leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}
            >
              Back
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={handleClose}>
              Cancel
            </Button>
          )}

          {currentStep < 4 ? (
            <Button
              variant="primary"
              size="sm"
              disabled={currentStep === 1 && !selectedCourtId}
              onClick={() => setCurrentStep((s) => Math.min(s + 1, 4))}
              rightIcon={<ArrowRight className="w-3.5 h-3.5" />}
            >
              Next Step
            </Button>
          ) : (
            <Button
              variant="primary"
              size="sm"
              isLoading={createJobMutation.isPending}
              onClick={handleStartDiscovery}
              leftIcon={<Zap className="w-3.5 h-3.5" />}
            >
              Start Discovery Job
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};
