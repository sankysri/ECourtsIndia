import React from 'react';
import { cn } from '../../utils/cn.js';

export const Skeleton = ({ className = '', variant = 'rect', ...props }) => {
  return (
    <div
      className={cn(
        'skeleton-shimmer bg-slate-200/80',
        variant === 'circle' && 'rounded-full',
        variant === 'rect' && 'rounded-lg',
        variant === 'text' && 'h-4 rounded',
        className
      )}
      {...props}
    />
  );
};

export const SkeletonCard = ({ className = '' }) => {
  return (
    <div className={cn('bg-white p-6 rounded-xl border border-slate-200/80 shadow-card space-y-4', className)}>
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-24" />
        <Skeleton variant="circle" className="w-8 h-8" />
      </div>
      <Skeleton className="h-8 w-32" />
      <Skeleton className="h-3 w-48" />
    </div>
  );
};
