import React, { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import { Card, CardHeader } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { Search, Sparkles, Scale, Building2, Calendar, FileText } from 'lucide-react';

export const SearchPage = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState('');

  const { data: searchResults, isLoading, isFetching } = useQuery({
    queryKey: ['liveSearch', query],
    queryFn: async () => {
      if (!query.trim()) return [];
      const res = await apiClient.get(`/api/cases?search=${encodeURIComponent(query.trim())}&limit=25`);
      return res.data.cases || [];
    },
    enabled: Boolean(query.trim()),
  });

  const cases = searchResults || [];

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Universal Legal Intelligence Search
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Full-text search across CNR numbers, litigant names, advocates, and judicial orders
          </p>
        </div>
        <Badge variant="navy" size="md">Indexed Ingestion Engine</Badge>
      </div>

      {/* Big Search Bar */}
      <Card className="p-6 bg-slate-900 text-white shadow-xl border-slate-800">
        <div className="max-w-3xl mx-auto space-y-4 text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-blue-500/20 text-blue-300 text-xs font-semibold mb-2">
            <Sparkles className="w-3.5 h-3.5" /> Real-time Case & Docket Search
          </div>
          <h2 className="text-xl sm:text-2xl font-bold tracking-tight">
            Search Court Records Across India
          </h2>
          <div className="relative">
            <Search className="w-5 h-5 text-slate-400 absolute left-4 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search by CNR (e.g. MHCC010000012026), Case Number, Litigant, or Court..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full pl-12 pr-4 py-3.5 bg-white text-slate-900 text-sm rounded-xl focus:outline-none focus:ring-4 focus:ring-blue-500/30 placeholder-slate-400 font-medium shadow-inner"
            />
          </div>
        </div>
      </Card>

      {/* Results Viewport */}
      {query.trim() ? (
        <div className="space-y-4">
          <div className="flex items-center justify-between px-2 text-xs text-slate-500">
            <span>
              Search Results for <strong className="text-slate-800">"{query}"</strong>
            </span>
            <span className="font-mono font-bold text-slate-700">
              {isLoading ? 'Searching...' : `${cases.length} records found`}
            </span>
          </div>

          {isLoading ? (
            <Card className="p-12 text-center text-xs text-slate-400">
              Searching national court database...
            </Card>
          ) : cases.length === 0 ? (
            <EmptyState
              icon={Search}
              title="No Matching Cases Found"
              description={`No court dockets matched the search term "${query}". Try searching by CNR number or filing year.`}
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {cases.map((c) => (
                <Card
                  key={c.id || c.cnr}
                  onClick={() => navigate(`/cases/${c.cnr}`)}
                  className="p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer space-y-3"
                >
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-xs font-extrabold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100">
                      {c.cnr}
                    </span>
                    <Badge variant={c.case_status === 'DISPOSED' ? 'default' : 'success'} size="sm">
                      {c.case_status || 'PENDING'}
                    </Badge>
                  </div>

                  <div>
                    <h3 className="text-sm font-bold text-slate-900 leading-snug line-clamp-2">
                      {c.title || `Case ${c.case_number || c.cnr}`}
                    </h3>
                    <p className="text-xs text-slate-500 font-mono mt-1">
                      {c.court_name || c.court_code}
                    </p>
                  </div>

                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-mono">
                    <span>Filing: {c.filing_date ? new Date(c.filing_date).toLocaleDateString() : 'N/A'}</span>
                    <span className="text-blue-600 font-bold hover:underline">View Dossier →</span>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </div>
      ) : (
        <EmptyState
          icon={Search}
          title="Universal Search Engine Ready"
          description="Type a 16-character CNR number, case registration number, litigant name, or court code into the search box above."
        />
      )}
    </div>
  );
};
