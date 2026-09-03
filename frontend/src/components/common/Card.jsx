import React from 'react';
import { cn } from '../../utils/cn.js';

export const Card = ({
  children,
  className = '',
  hoverEffect = false,
  padded = true,
  ...props
}) => {
  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-slate-200/80 shadow-card transition-all duration-200',
        hoverEffect && 'hover:shadow-elevated hover:border-slate-300',
        padded && 'p-5 sm:p-6',
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
};

export const CardHeader = ({
  title,
  subtitle,
  badge,
  action,
  className = '',
}) => {
  return (
    <div className={cn('flex items-start justify-between gap-4 mb-4', className)}>
      <div>
        <div className="flex items-center gap-2.5">
          <h3 className="font-semibold text-slate-900 text-base sm:text-lg tracking-tight">
            {title}
          </h3>
          {badge}
        </div>
        {subtitle && <p className="text-xs sm:text-sm text-slate-500 mt-0.5">{subtitle}</p>}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
};
