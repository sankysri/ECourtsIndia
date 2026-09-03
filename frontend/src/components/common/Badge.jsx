import React from 'react';
import { cn } from '../../utils/cn.js';

export const Badge = ({
  children,
  variant = 'default', // 'default' | 'success' | 'warning' | 'danger' | 'info' | 'purple' | 'navy'
  size = 'md', // 'sm' | 'md'
  className = '',
  dot = false,
}) => {
  const sizeStyles = {
    sm: 'text-[10px] px-2 py-0.5 font-medium tracking-wide uppercase',
    md: 'text-xs px-2.5 py-1 font-medium',
  };

  const variantStyles = {
    default: 'bg-slate-100 text-slate-700 border border-slate-200',
    success: 'bg-emerald-50 text-emerald-700 border border-emerald-200',
    warning: 'bg-amber-50 text-amber-700 border border-amber-200',
    danger: 'bg-rose-50 text-rose-700 border border-rose-200',
    info: 'bg-blue-50 text-blue-700 border border-blue-200',
    purple: 'bg-purple-50 text-purple-700 border border-purple-200',
    navy: 'bg-slate-900 text-slate-100 border border-slate-800',
  };

  const dotColors = {
    default: 'bg-slate-400',
    success: 'bg-emerald-500 animate-pulse',
    warning: 'bg-amber-500',
    danger: 'bg-rose-500 animate-pulse',
    info: 'bg-blue-500',
    purple: 'bg-purple-500',
    navy: 'bg-blue-400',
  };

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 rounded-full whitespace-nowrap',
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
    >
      {dot && <span className={cn('w-1.5 h-1.5 rounded-full', dotColors[variant])} />}
      {children}
    </span>
  );
};
