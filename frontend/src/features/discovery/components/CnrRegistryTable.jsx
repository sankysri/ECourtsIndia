import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../../api/client.js';
import { Badge } from '../../../components/common/Badge.jsx';
import { Button } from '../../../components/common/Button.jsx';
import {
  Scale,
  Search,
  Filter,
  ChevronLeft,
  ChevronRight,
  Clock,
  Building2,
  Calendar,
  Layers,
  Sparkles,
} from 'lucide-react';

export const CnrRegistryTable = () => {
  const [search, setSearch] = useState('');
  const [syncStatus, setSyncStatus] = useState('');
  const [page, setPage] = useState(1);
  const limit = 20;
  const offset = (page - 1) * limit;

  const { data: registryData, isLoading } = useQuery({
    queryKey: ['cnrRegistryList', search, syncStatus, page],
    queryFn: async () => {
      const params = new URLSearchParams({
        search,
        syncStatus,
        limit: String(limit),
        offset: String(offset),
      });
      const res = await apiClient.get(`/api/discovery/registry?${params.toString()}`);
      return res.data;
    },
    keepPreviousData: true,
  });

  const cases = registryData?.cases || [];
  const total = registryData?.total || 0;
  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="space-y-4 font-sans">
      {/* Search & Filter Bar */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-white p-3.5 rounded-xl border border-slate-200/80 shadow-2xs text-xs">
        <div className="relative flex-1 w-full">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search by 16-character CNR, case number, or court name..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="w-full pl-9 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 focus:ring-2 focus:ring-blue-500 focus:bg-white"
          />
        </div>

        <div className="flex items-center gap-2 w-full sm:w-auto">
          <select
            value={syncStatus}
            onChange={(e) => {
              setSyncStatus(e.target.value);
              setPage(1);
            }}
            className="bg-slate-50 border border-slate-200 rounded-lg px-3 py-2 text-slate-700 focus:ring-2 focus:ring-blue-500"
          >
            <option value="">All Sync States</option>
            <option value="PENDING_DETAIL">Pending Detail Sync</option>
            <option value="SYNCED">Fully Synchronized</option>
            <option value="FAILED">Sync Failed</option>
          </select>
        </div>
      </div>

      {/* CNR Table */}
      <div className="bg-white rounded-xl border border-slate-200/80 shadow-card overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
              <tr>
                <th className="py-3 px-4">16-Character CNR</th>
                <th className="py-3 px-4">Court Complex</th>
                <th className="py-3 px-4">Case Details</th>
                <th className="py-3 px-4">First Discovered</th>
                <th className="py-3 px-4">Last Discovered</th>
                <th className="py-3 px-4">Sync Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-400">
                    Loading discovered cases from registry...
                  </td>
                </tr>
              ) : !cases.length ? (
                <tr>
                  <td colSpan={6} className="py-8 text-center text-slate-500">
                    No cases in registry. Execute a discovery job to ingest CNR numbers.
                  </td>
                </tr>
              ) : (
                cases.map((c) => (
                  <tr key={c.id || c.cnr} className="hover:bg-slate-50/70 transition-colors">
                    {/* CNR */}
                    <td className="py-3 px-4 font-mono font-bold text-blue-700">
                      <div className="flex items-center gap-2">
                        <Scale className="w-3.5 h-3.5 text-blue-500" />
                        <span>{c.cnr}</span>
                      </div>
                    </td>

                    {/* Court */}
                    <td className="py-3 px-4 font-medium text-slate-900">
                      <div>{c.court_name}</div>
                      <div className="text-[10px] text-slate-400 font-mono">
                        {c.court_code} • {c.state_code}
                      </div>
                    </td>

                    {/* Case Metadata */}
                    <td className="py-3 px-4 text-slate-700">
                      {c.metadata?.caseNumber ? (
                        <div>
                          <div className="font-semibold">{c.metadata.caseNumber}</div>
                          <div className="text-[10px] text-slate-400">{c.metadata.title}</div>
                        </div>
                      ) : (
                        <span className="text-slate-400 font-mono">Pending details</span>
                      )}
                    </td>

                    {/* First Discovered */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-600">
                      {new Date(c.first_discovered_at).toLocaleDateString()}
                    </td>

                    {/* Last Discovered */}
                    <td className="py-3 px-4 font-mono text-[11px] text-slate-500">
                      {new Date(c.last_discovered_at).toLocaleTimeString()}
                    </td>

                    {/* Sync Status Badge */}
                    <td className="py-3 px-4">
                      <Badge
                        variant={c.sync_status === 'SYNCED' ? 'success' : 'info'}
                        size="sm"
                        dot
                      >
                        {c.sync_status.replace(/_/g, ' ')}
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination Controls */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-2 text-xs text-slate-500">
        <div>
          Showing <span className="font-mono font-semibold text-slate-900">{total === 0 ? 0 : offset + 1}</span> to{' '}
          <span className="font-mono font-semibold text-slate-900">{Math.min(offset + limit, total)}</span> of{' '}
          <span className="font-mono font-semibold text-slate-900">{total}</span> registered CNRs
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
