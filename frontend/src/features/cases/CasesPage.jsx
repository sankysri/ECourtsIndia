import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.js';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { useNavigate } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { addToast } from '../../store/slices/notificationSlice.js';
import { PermissionGuard } from '../../components/common/PermissionGuard.jsx';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  Scale,
  Search,
  Filter,
  Plus,
  Compass,
  Building2,
  Calendar,
  Clock,
  ChevronLeft,
  ChevronRight,
  RefreshCw,
  Sparkles,
  ArrowUpDown,
} from 'lucide-react';

export const CasesPage = () => {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();

  const [search, setSearch] = useState('');
  const [selectedCourt, setSelectedCourt] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [selectedCaseType, setSelectedCaseType] = useState('');
  const [selectedYear, setSelectedYear] = useState('');
  const [sortBy, setSortBy] = useState('filing_date');
  const [sortOrder, setSortOrder] = useState('DESC');
  const [page, setPage] = useState(1);
  const limit = 20;
  const offset = (page - 1) * limit;

  // 1. Fetch Dynamic Courts for Filter
  const { data: courtsData } = useQuery({
    queryKey: ['filterCourtsList'],
    queryFn: async () => {
      const res = await apiClient.get('/api/courts?limit=50');
      return res.data.courts;
    },
    staleTime: 60000,
  });

  // 2. Fetch Detailed Cases List
  const { data: casesData, isLoading, refetch } = useQuery({
    queryKey: ['casesList', search, selectedCourt, selectedStatus, selectedCaseType, selectedYear, sortBy, sortOrder, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        courtId: selectedCourt,
        status: selectedStatus,
        caseType: selectedCaseType,
        filingYear: selectedYear,
        sortBy,
        sortOrder,
        limit: String(limit),
        offset: String(offset),
      });
      const res = await apiClient.get(`/api/cases?${params.toString()}`);
      return res.data;
    },
    keepPreviousData: true,
  });

  // 3. Batch Sync Mutation
  const batchSyncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/api/cases/batch-sync', { limit: 10 });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['casesList'] });
      queryClient.invalidateQueries({ queryKey: ['cnrRegistryList'] });
      dispatch(
        addToast({
          type: 'success',
          title: 'Batch Sync Dispatched',
          message: `Dispatched case detail ingestion for ${data.count} pending dockets.`,
        })
      );
    },
    onError: (err) => {
      dispatch(
        addToast({
          type: 'error',
          title: 'Batch Sync Failed',
          message: err.message || 'Could not initiate batch sync',
        })
      );
    },
  });

  const cases = casesData?.cases || [];
  const total = casesData?.total || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  const handleSort = (col) => {
    const nextOrder = sortBy === col && sortOrder === 'ASC' ? 'DESC' : 'ASC';
    setSortBy(col);
    setSortOrder(nextOrder);
  };

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Case Intelligence Dossiers
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Normalized court dockets, parties, legal counsel, bench coram, and hearing timelines
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <PermissionGuard permission={PERMISSIONS.START_SYNC}>
            <Button
              variant="outline"
              size="sm"
              isLoading={batchSyncMutation.isPending}
              onClick={() => batchSyncMutation.mutate()}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Sync Pending Dockets
            </Button>
          </PermissionGuard>

          <PermissionGuard permission={PERMISSIONS.VIEW_DISCOVERY}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => navigate('/discovery')}
              leftIcon={<Compass className="w-3.5 h-3.5" />}
            >
              Discover Cases
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Control & Multi-Filter Bar */}
      <Card className="p-4 space-y-3">
        <div className="relative flex-1 w-full">
          <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by CNR, Case Number, Party Name, or Court Establishment..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        {/* Dynamic Filters */}
        <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
          <div className="flex items-center gap-1.5 text-slate-500 mr-1 font-semibold">
            <Filter className="w-3.5 h-3.5" /> Filters:
          </div>

          {/* Court Filter */}
          <select
            value={selectedCourt}
            onChange={(e) => {
              setSelectedCourt(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Courts ({courtsData?.length || 0})</option>
            {courtsData?.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>

          {/* Case Type Filter */}
          <select
            value={selectedCaseType}
            onChange={(e) => {
              setSelectedCaseType(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Case Types</option>
            <option value="WP">Writ Petition (WP)</option>
            <option value="CS">Civil Suit (CS)</option>
            <option value="CC">Criminal Case (CC)</option>
            <option value="BAIL_APPL">Bail Application</option>
            <option value="ARB_PET">Arbitration Petition</option>
          </select>

          {/* Status Filter */}
          <select
            value={selectedStatus}
            onChange={(e) => {
              setSelectedStatus(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Statuses</option>
            <option value="PENDING">PENDING</option>
            <option value="DISPOSED">DISPOSED</option>
          </select>

          {/* Filing Year Filter */}
          <select
            value={selectedYear}
            onChange={(e) => {
              setSelectedYear(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:ring-2 focus:ring-blue-500 font-mono"
          >
            <option value="">All Years</option>
            {[2026, 2025, 2024, 2023, 2022, 2021, 2020].map((y) => (
              <option key={y} value={String(y)}>
                {y}
              </option>
            ))}
          </select>

          {(selectedCourt || selectedCaseType || selectedStatus || selectedYear || search) && (
            <button
              onClick={() => {
                setSelectedCourt('');
                setSelectedCaseType('');
                setSelectedStatus('');
                setSelectedYear('');
                setSearch('');
                setPage(1);
              }}
              className="text-blue-600 hover:underline font-semibold ml-auto"
            >
              Clear filters
            </button>
          )}
        </div>
      </Card>

      {/* Cases Data Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th onClick={() => handleSort('cnr')} className="py-3 px-4 cursor-pointer hover:bg-slate-100 select-none">
                  CNR & Number
                </th>
                <th className="py-3 px-4">Case Title & Parties</th>
                <th className="py-3 px-4">Court Establishment</th>
                <th onClick={() => handleSort('filing_date')} className="py-3 px-4 cursor-pointer hover:bg-slate-100 select-none">
                  Filing Date
                </th>
                <th onClick={() => handleSort('next_hearing_date')} className="py-3 px-4 cursor-pointer hover:bg-slate-100 select-none">
                  Next Hearing
                </th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-400">
                    Loading normalized case dossiers...
                  </td>
                </tr>
              ) : !cases.length ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500 space-y-2">
                    <p>No cases matched your criteria or pending detail sync.</p>
                    <Button variant="outline" size="xs" onClick={() => navigate('/discovery')}>
                      Run Discovery Engine
                    </Button>
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr
                    key={c.id || c.cnr}
                    onClick={() => navigate(`/cases/${c.cnr}`)}
                    className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
                  >
                    {/* CNR & Number */}
                    <td className="py-3.5 px-4 font-mono">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                          <Scale className="w-3.5 h-3.5" />
                        </div>
                        <div>
                          <div className="font-bold text-blue-700 group-hover:text-blue-600 transition-colors">
                            {c.cnr}
                          </div>
                          <div className="text-[10px] text-slate-500 font-normal">
                            {c.case_number || c.case_type}
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Case Title */}
                    <td className="py-3.5 px-4 text-slate-900 max-w-xs">
                      <div className="font-semibold truncate">{c.title || `${c.case_type} Docket`}</div>
                      <div className="text-[10px] text-slate-400 truncate">{c.under_acts}</div>
                    </td>

                    {/* Court */}
                    <td className="py-3.5 px-4 text-slate-700">
                      <div className="font-medium">{c.court_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {c.court_code} • {c.state_code}
                      </div>
                    </td>

                    {/* Filing Date */}
                    <td className="py-3.5 px-4 font-mono text-[11px] text-slate-600">
                      {c.filing_date ? new Date(c.filing_date).toLocaleDateString() : 'N/A'}
                    </td>

                    {/* Next Hearing */}
                    <td className="py-3.5 px-4 font-mono text-[11px]">
                      {c.next_hearing_date ? (
                        <span className="text-blue-700 font-semibold">{new Date(c.next_hearing_date).toLocaleDateString()}</span>
                      ) : (
                        <span className="text-slate-400">-</span>
                      )}
                    </td>

                    {/* Status */}
                    <td className="py-3.5 px-4">
                      <Badge variant={c.case_status === 'DISPOSED' ? 'default' : 'success'} size="sm" dot>
                        {c.case_status}
                      </Badge>
                    </td>

                    {/* Action */}
                    <td className="py-3.5 px-4 text-right">
                      <button className="p-1 rounded-md text-slate-400 group-hover:text-blue-600 hover:bg-slate-100 transition-colors">
                        <ChevronRight className="w-4 h-4" />
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 text-xs text-slate-500">
        <div>
          Showing <span className="font-mono font-semibold text-slate-900">{total === 0 ? 0 : offset + 1}</span> to{' '}
          <span className="font-mono font-semibold text-slate-900">{Math.min(offset + limit, total)}</span> of{' '}
          <span className="font-mono font-semibold text-slate-900">{total}</span> dossiers
        </div>

        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(p - 1, 1))}
            leftIcon={<ChevronLeft className="w-3.5 h-3.5" />}
          >
            Previous
          </Button>

          <span className="font-mono text-slate-700 px-2 font-semibold">
            Page {page} of {totalPages}
          </span>

          <Button
            variant="outline"
            size="sm"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(p + 1, totalPages))}
            rightIcon={<ChevronRight className="w-3.5 h-3.5" />}
          >
            Next
          </Button>
        </div>
      </div>
    </div>
  );
};
