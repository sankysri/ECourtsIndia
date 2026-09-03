import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../api/client.js';
import { Card } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { CourtTable } from './components/CourtTable.jsx';
import { CourtHierarchyTree } from './components/CourtHierarchyTree.jsx';
import { CourtSyncModal } from './components/CourtSyncModal.jsx';
import { PermissionGuard } from '../../components/common/PermissionGuard.jsx';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  Building2,
  Search,
  Filter,
  RefreshCw,
  Layers,
  Table as TableIcon,
  GitBranch,
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';

export const CourtsPage = () => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedState, setSelectedState] = useState('');
  const [selectedType, setSelectedType] = useState('');
  const [selectedStatus, setSelectedStatus] = useState('');
  const [sortBy, setSortBy] = useState('name');
  const [sortOrder, setSortOrder] = useState('ASC');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const [viewMode, setViewMode] = useState('table'); // 'table' | 'hierarchy'
  const [syncModalOpen, setSyncModalOpen] = useState(false);

  // 1. Fetch Dynamic Metadata & Enums
  const { data: metadata } = useQuery({
    queryKey: ['courtMetadata'],
    queryFn: async () => {
      const res = await apiClient.get('/api/courts/metadata');
      return res.data;
    },
    staleTime: 60000,
  });

  // 2. Fetch Paginated Courts List
  const offset = (page - 1) * limit;
  const {
    data: courtsData,
    isLoading: courtsLoading,
    refetch: refetchCourts,
    isFetching,
  } = useQuery({
    queryKey: [
      'courtsList',
      { search: searchTerm, state: selectedState, type: selectedType, status: selectedStatus, sortBy, sortOrder, limit, offset },
    ],
    queryFn: async () => {
      const params = new URLSearchParams({
        search: searchTerm,
        state: selectedState,
        type: selectedType,
        status: selectedStatus,
        sortBy,
        sortOrder,
        limit: String(limit),
        offset: String(offset),
      });
      const res = await apiClient.get(`/api/courts?${params.toString()}`);
      return res.data;
    },
    keepPreviousData: true,
  });

  // 3. Fetch Full Hierarchy Tree
  const { data: hierarchyData, isLoading: hierarchyLoading } = useQuery({
    queryKey: ['courtHierarchy'],
    queryFn: async () => {
      const res = await apiClient.get('/api/courts/hierarchy');
      return res.data.hierarchy;
    },
    enabled: viewMode === 'hierarchy',
    staleTime: 30000,
  });

  const handleSort = (column, direction) => {
    setSortBy(column);
    setSortOrder(direction);
  };

  const totalCourts = courtsData?.total || 0;
  const totalPages = Math.ceil(totalCourts / limit) || 1;

  const states = metadata?.states || [];
  const courtTypes = metadata?.enums?.court_types || [];

  return (
    <div className="space-y-6 animate-fadeIn pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Court Establishments Master
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Indian judicial directory with jurisdictional hierarchy, complex codes, and sync state
          </p>
        </div>

        <div className="flex items-center gap-2.5">
          <PermissionGuard permission={PERMISSIONS.SYNC_COURTS}>
            <Button
              variant="primary"
              size="sm"
              onClick={() => setSyncModalOpen(true)}
              leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
            >
              Sync Courts
            </Button>
          </PermissionGuard>
        </div>
      </div>

      {/* Control / Filter Bar */}
      <Card className="p-4 space-y-3">
        <div className="flex flex-col md:flex-row items-center justify-between gap-3">
          {/* Search Input */}
          <div className="relative flex-1 w-full">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by court name, complex code, district, or state..."
              value={searchTerm}
              onChange={(e) => {
                setSearchTerm(e.target.value);
                setPage(1);
              }}
              className="w-full text-xs pl-10 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
          </div>

          {/* View Mode Toggle Switcher */}
          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-lg border border-slate-200 shrink-0">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'table'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <TableIcon className="w-3.5 h-3.5" />
              Table Grid
            </button>
            <button
              onClick={() => setViewMode('hierarchy')}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-semibold transition-all ${
                viewMode === 'hierarchy'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-500 hover:text-slate-900'
              }`}
            >
              <GitBranch className="w-3.5 h-3.5" />
              Hierarchy Tree
            </button>
          </div>
        </div>

        {/* Dynamic Filters Bar */}
        {viewMode === 'table' && (
          <div className="flex flex-wrap items-center gap-2.5 pt-2 border-t border-slate-100 text-xs">
            <div className="flex items-center gap-1.5 text-slate-500 mr-1 font-semibold">
              <Filter className="w-3.5 h-3.5" /> Filters:
            </div>

            {/* State Filter (Dynamic from DB) */}
            <select
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All States / UTs ({states.length})</option>
              {states.map((s) => (
                <option key={s.code} value={s.code}>
                  {s.name} ({s.code})
                </option>
              ))}
            </select>

            {/* Court Type Filter (Dynamic from API Enums) */}
            <select
              value={selectedType}
              onChange={(e) => {
                setSelectedType(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Court Types ({courtTypes.length})</option>
              {courtTypes.map((t) => (
                <option key={t.code} value={t.code}>
                  {t.label}
                </option>
              ))}
            </select>

            {/* Status Filter */}
            <select
              value={selectedStatus}
              onChange={(e) => {
                setSelectedStatus(e.target.value);
                setPage(1);
              }}
              className="bg-slate-50 border border-slate-200 rounded-lg px-2.5 py-1.5 text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="INACTIVE">INACTIVE</option>
            </select>

            {(selectedState || selectedType || selectedStatus || searchTerm) && (
              <button
                onClick={() => {
                  setSelectedState('');
                  setSelectedType('');
                  setSelectedStatus('');
                  setSearchTerm('');
                  setPage(1);
                }}
                className="text-blue-600 hover:underline font-semibold ml-auto"
              >
                Clear all filters
              </button>
            )}
          </div>
        )}
      </Card>

      {/* Main Content Viewport */}
      {viewMode === 'table' ? (
        <div className="space-y-4">
          <CourtTable
            courts={courtsData?.courts || []}
            sortBy={sortBy}
            sortOrder={sortOrder}
            onSort={handleSort}
          />

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 text-xs text-slate-500">
            <div>
              Showing <span className="font-mono font-semibold text-slate-900">{totalCourts === 0 ? 0 : offset + 1}</span> to{' '}
              <span className="font-mono font-semibold text-slate-900">
                {Math.min(offset + limit, totalCourts)}
              </span>{' '}
              of <span className="font-mono font-semibold text-slate-900">{totalCourts}</span> courts
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
      ) : (
        <CourtHierarchyTree hierarchy={hierarchyData || []} />
      )}

      {/* Sync Modal */}
      <CourtSyncModal isOpen={syncModalOpen} onClose={() => setSyncModalOpen(false)} />
    </div>
  );
};
