import React from 'react';
import { useNavigate } from 'react-router-dom';
import { Badge } from '../../../components/common/Badge.jsx';
import { Building2, ArrowUpDown, ChevronRight, Scale, Clock } from 'lucide-react';

export const CourtTable = ({ courts = [], sortBy, sortOrder, onSort }) => {
  const navigate = useNavigate();

  const handleHeaderClick = (col) => {
    if (onSort) {
      const nextOrder = sortBy === col && sortOrder === 'ASC' ? 'DESC' : 'ASC';
      onSort(col, nextOrder);
    }
  };

  if (!courts.length) {
    return (
      <div className="p-12 text-center text-xs text-slate-500 bg-white rounded-xl border border-dashed border-slate-300">
        No courts matched your search and filter criteria.
      </div>
    );
  }

  const renderSortIndicator = (col) => {
    if (sortBy === col) {
      return <span className="text-blue-600 font-bold ml-1">{sortOrder === 'ASC' ? '↑' : '↓'}</span>;
    }
    return <ArrowUpDown className="w-3 h-3 text-slate-300 ml-1 inline opacity-0 group-hover:opacity-100 transition-opacity" />;
  };

  return (
    <div className="bg-white rounded-xl border border-slate-200/80 shadow-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
            <tr>
              <th
                onClick={() => handleHeaderClick('name')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100 select-none group"
              >
                Court Name {renderSortIndicator('name')}
              </th>
              <th
                onClick={() => handleHeaderClick('code')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100 select-none group"
              >
                Court Code {renderSortIndicator('code')}
              </th>
              <th
                onClick={() => handleHeaderClick('type')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100 select-none group"
              >
                Court Type {renderSortIndicator('type')}
              </th>
              <th className="py-3 px-4">State</th>
              <th className="py-3 px-4">District</th>
              <th
                onClick={() => handleHeaderClick('total_cases')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100 select-none group text-right"
              >
                Total Cases {renderSortIndicator('total_cases')}
              </th>
              <th
                onClick={() => handleHeaderClick('last_sync_at')}
                className="py-3 px-4 cursor-pointer hover:bg-slate-100 select-none group"
              >
                Last Sync {renderSortIndicator('last_sync_at')}
              </th>
              <th className="py-3 px-4">Status</th>
              <th className="py-3 px-4 text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {courts.map((court) => (
              <tr
                key={court.id}
                onClick={() => navigate(`/courts/${court.id}`)}
                className="hover:bg-blue-50/40 cursor-pointer transition-colors group"
              >
                <td className="py-3.5 px-4 font-semibold text-slate-900">
                  <div className="flex items-center gap-2.5">
                    <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0 group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Building2 className="w-3.5 h-3.5" />
                    </div>
                    <div>
                      <span className="group-hover:text-blue-600 transition-colors">{court.name}</span>
                      {court.parent_court_name && (
                        <div className="text-[10px] text-slate-400 font-normal">
                          Bench of {court.parent_court_name}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="py-3.5 px-4 font-mono text-slate-600">{court.code}</td>
                <td className="py-3.5 px-4">
                  <Badge
                    variant={
                      court.type === 'HIGH_COURT'
                        ? 'purple'
                        : court.type === 'CITY_CIVIL_COURT'
                        ? 'info'
                        : 'default'
                    }
                    size="sm"
                  >
                    {court.type.replace(/_/g, ' ')}
                  </Badge>
                </td>
                <td className="py-3.5 px-4 text-slate-700 font-medium">
                  {court.state_name} <span className="text-[10px] text-slate-400 font-mono">({court.state_code})</span>
                </td>
                <td className="py-3.5 px-4 text-slate-600">
                  {court.district_name || <span className="text-slate-400 italic">State Principal Bench</span>}
                </td>
                <td className="py-3.5 px-4 font-mono font-semibold text-slate-800 text-right">
                  {court.total_cases?.toLocaleString() || 0}
                </td>
                <td className="py-3.5 px-4 text-slate-500 font-mono text-[11px]">
                  {court.last_sync_at ? (
                    new Date(court.last_sync_at).toLocaleDateString()
                  ) : (
                    <span className="text-slate-400">Pending</span>
                  )}
                </td>
                <td className="py-3.5 px-4">
                  <Badge variant={court.status === 'ACTIVE' ? 'success' : 'warning'} size="sm" dot>
                    {court.status || 'ACTIVE'}
                  </Badge>
                </td>
                <td className="py-3.5 px-4 text-right">
                  <button className="p-1 rounded-md text-slate-400 group-hover:text-blue-600 hover:bg-slate-100 transition-colors">
                    <ChevronRight className="w-4 h-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
