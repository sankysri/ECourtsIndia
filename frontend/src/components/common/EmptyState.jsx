import React from 'react';
import { Database, RefreshCw } from 'lucide-react';
import { Button } from './Button.jsx';
import { cn } from '../../utils/cn.js';

export const EmptyState = ({
  icon: Icon = Database,
  title = 'No records found',
  description = 'There is currently no data available for this section. Configure ingestion or trigger discovery to populate.',
  actionText,
  onAction,
  isLoading = false,
  className = '',
}) => {
  return (
    <div
      className={cn(
        'flex flex-col items-center justify-center p-8 sm:p-12 text-center bg-white rounded-xl border border-dashed border-slate-300',
        className
      )}
    >
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 mb-4 ring-8 ring-slate-50">
        <Icon className="w-6 h-6" />
      </div>
      <h4 className="text-base font-semibold text-slate-800 tracking-tight">{title}</h4>
      <p className="text-xs sm:text-sm text-slate-500 max-w-sm mt-1 mb-6 leading-relaxed">
        {description}
      </p>
      {actionText && (
        <Button
          variant="outline"
          size="sm"
          onClick={onAction}
          isLoading={isLoading}
          leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
        >
          {actionText}
        </Button>
      )}
    </div>
  );
};
