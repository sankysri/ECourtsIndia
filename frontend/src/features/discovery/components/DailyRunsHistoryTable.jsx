import React from 'react';
import { Badge } from '../../../components/common/Badge.jsx';
import { Card } from '../../../components/common/Card.jsx';
import {
  Calendar,
  Layers,
  Clock,
  CheckCircle2,
  AlertCircle,
  Activity,
  ArrowRight,
} from 'lucide-react';

export const DailyRunsHistoryTable = ({ runs = [], isLoading = false }) => {
  if (isLoading) {
    return (
      <Card className="p-8 text-center text-slate-500 text-xs">
        <Activity className="w-6 h-6 animate-spin mx-auto mb-2 text-blue-600" />
        Loading daily discovery run audit logs...
      </Card>
    );
  }

  if (runs.length === 0) {
    return (
      <Card className="p-8 text-center text-slate-500 text-xs">
        <Calendar className="w-8 h-8 mx-auto mb-2 text-slate-300" />
        No daily discovery runs recorded yet. Click "Run Daily Discovery Now" to launch your first incremental run.
      </Card>
    );
  }

  const getStatusBadge = (status) => {
    switch (status) {
      case 'COMPLETED':
        return <Badge variant="success">Completed</Badge>;
      case 'RUNNING':
        return <Badge variant="primary">Running</Badge>;
      case 'FAILED':
        return <Badge variant="danger">Failed</Badge>;
      default:
        return <Badge variant="neutral">{status}</Badge>;
    }
  };

  const getWindowLabel = (w) => {
    switch (w) {
      case 'TODAY':
        return 'Today (Same Day)';
      case 'YESTERDAY':
        return 'Yesterday (24h)';
      case 'LAST_7_DAYS':
        return 'Last 7 Days';
      case 'LAST_30_DAYS':
        return 'Last 30 Days';
      default:
        return w;
    }
  };

  return (
    <Card className="overflow-hidden border border-slate-200 shadow-sm font-sans">
      <div className="px-5 py-3.5 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Clock className="w-4 h-4 text-slate-600" />
          <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
            Daily Incremental Discovery Runs ({runs.length})
          </h3>
        </div>
        <span className="text-[11px] text-slate-500 font-medium">Automatic & manual executions</span>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-left text-xs text-slate-700">
          <thead className="bg-slate-50 text-[11px] uppercase tracking-wider text-slate-500 font-semibold border-b border-slate-200">
            <tr>
              <th className="py-2.5 px-4">Run Started</th>
              <th className="py-2.5 px-4">Lookback Window</th>
              <th className="py-2.5 px-4">Courts Scanned</th>
              <th className="py-2.5 px-4">Total Cases</th>
              <th className="py-2.5 px-4">New CNRs</th>
              <th className="py-2.5 px-4">Status</th>
              <th className="py-2.5 px-4">Completed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {runs.map((run) => (
              <tr key={run.id} className="hover:bg-slate-50/70 transition-colors">
                <td className="py-3 px-4 font-mono text-[11px] text-slate-900 font-semibold">
                  {run.started_at ? new Date(run.started_at).toLocaleString() : '—'}
                </td>
                <td className="py-3 px-4">
                  <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-semibold bg-blue-50 text-blue-700 border border-blue-200">
                    {getWindowLabel(run.lookback_window)}
                  </span>
                </td>
                <td className="py-3 px-4 font-mono font-bold text-slate-800">
                  {run.courts_scanned || run.jobs_created || 0} Courts
                </td>
                <td className="py-3 px-4 font-mono text-slate-600">
                  {(run.total_cases_found || 0).toLocaleString()}
                </td>
                <td className="py-3 px-4 font-mono font-bold text-emerald-600">
                  +{run.new_cnrs_found || 0}
                </td>
                <td className="py-3 px-4">
                  {getStatusBadge(run.status)}
                </td>
                <td className="py-3 px-4 text-[11px] text-slate-500">
                  {run.completed_at ? new Date(run.completed_at).toLocaleTimeString() : 'In Progress'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
};
