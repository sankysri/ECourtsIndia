import React from 'react';
import { cn } from '../../utils/cn.js';

export const FormCheckbox = React.forwardRef(
  ({ label, name, error, className = '', ...props }, ref) => {
    return (
      <div className={cn('flex items-center gap-2.5', className)}>
        <input
          ref={ref}
          id={name}
          name={name}
          type="checkbox"
          className="w-4 h-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
          {...props}
        />
        {label && (
          <label htmlFor={name} className="text-xs font-medium text-slate-700 cursor-pointer select-none">
            {label}
          </label>
        )}
      </div>
    );
  }
);

FormCheckbox.displayName = 'FormCheckbox';
