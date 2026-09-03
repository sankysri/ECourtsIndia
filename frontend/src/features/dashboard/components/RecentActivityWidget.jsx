import React from 'react';
import { Card, CardHeader } from '../../../components/common/Card.jsx';
import { Badge } from '../../../components/common/Badge.jsx';
import { ShieldCheck, User, Zap, Activity } from 'lucide-react';

export const RecentActivityWidget = ({ auditLogs = [] }) => {
  const activities = auditLogs.slice(0, 5);

  return (
    <Card>
      <CardHeader
        title="Recent Platform Activity"
        subtitle="Live audit trail of ingestion and administrative operations"
        badge={<Badge variant="default" size="sm">Audit Log</Badge>}
      />

      <div className="divide-y divide-slate-100">
        {activities.length === 0 ? (
          <div className="py-6 text-center text-xs text-slate-400">
            No recent activity recorded yet.
          </div>
        ) : (
          activities.map((act) => (
            <div
              key={act.id}
              className="py-3 flex items-start gap-3 hover:bg-slate-50/70 px-2 rounded-lg transition-colors"
            >
              <div className="w-8 h-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center shrink-0 mt-0.5">
                {act.action?.includes('USER') || act.action?.includes('LOGIN') ? (
                  <User className="w-4 h-4 text-blue-600" />
                ) : act.action?.includes('QUEUE') ? (
                  <Zap className="w-4 h-4 text-amber-600" />
                ) : (
                  <ShieldCheck className="w-4 h-4 text-emerald-600" />
                )}
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-xs text-slate-900 truncate">
                    {act.action?.replace(/_/g, ' ') || 'Operation'}
                  </span>
                  <span className="text-[10px] text-slate-400 shrink-0 font-mono">
                    {act.created_at
                      ? new Date(act.created_at).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })
                      : ''}
                  </span>
                </div>
                <p className="text-xs text-slate-600 truncate mt-0.5">
                  {typeof act.details === 'string'
                    ? act.details
                    : act.details?.message || JSON.stringify(act.details) || act.entity}
                </p>
                <div className="text-[10px] text-slate-400 mt-1 flex items-center gap-1 font-mono">
                  <span className="text-slate-500">{act.user_email || 'System'}</span> • {act.entity}
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </Card>
  );
};
