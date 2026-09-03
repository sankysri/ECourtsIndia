import React from 'react';
import { Card } from '../../../components/common/Card.jsx';
import { Badge } from '../../../components/common/Badge.jsx';
import { cn } from '../../../utils/cn.js';

export const StatsCard = ({
  title,
  value,
  subvalue,
  icon: Icon,
  iconBg = 'bg-blue-50 text-blue-600',
  trend,
  trendType = 'neutral', // 'positive' | 'negative' | 'neutral'
  badgeText,
  badgeVariant = 'default',
  onClick,
}) => {
  return (
    <Card
      hoverEffect={Boolean(onClick)}
      onClick={onClick}
      className={cn('p-5 flex flex-col justify-between cursor-default', onClick && 'cursor-pointer')}
    >
      <div className="flex items-start justify-between">
        <div>
          <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">
            {title}
          </span>
          <div className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight mt-1.5 font-mono">
            {typeof value === 'number' ? value.toLocaleString() : value}
          </div>
        </div>
        <div className={cn('w-10 h-10 rounded-xl flex items-center justify-center shrink-0 shadow-2xs', iconBg)}>
          <Icon className="w-5 h-5" />
        </div>
      </div>

      <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
        <span className="truncate">{subvalue || 'Platform baseline'}</span>
        {badgeText && (
          <Badge variant={badgeVariant} size="sm">
            {badgeText}
          </Badge>
        )}
      </div>
    </Card>
  );
};
