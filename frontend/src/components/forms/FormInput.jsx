import React from 'react';
import { cn } from '../../utils/cn.js';

export const FormInput = React.forwardRef(
  (
    {
      label,
      name,
      type = 'text',
      placeholder,
      error,
      helperText,
      leftIcon,
      rightIcon,
      className = '',
      required = false,
      ...props
    },
    ref
  ) => {
    return (
      <div className={cn('space-y-1.5 w-full', className)}>
        {label && (
          <label htmlFor={name} className="block text-xs font-semibold text-slate-700">
            {label} {required && <span className="text-rose-500">*</span>}
          </label>
        )}
        <div className="relative rounded-lg shadow-2xs">
          {leftIcon && (
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
              {leftIcon}
            </div>
          )}
          <input
            ref={ref}
            id={name}
            name={name}
            type={type}
            placeholder={placeholder}
            className={cn(
              'block w-full text-sm rounded-lg border bg-white px-3.5 py-2.5 transition-colors placeholder:text-slate-400 focus:outline-none focus:ring-2',
              leftIcon && 'pl-10',
              rightIcon && 'pr-10',
              error
                ? 'border-rose-300 text-rose-900 focus:border-rose-500 focus:ring-rose-200'
                : 'border-slate-300 text-slate-900 focus:border-blue-600 focus:ring-blue-100'
            )}
            {...props}
          />
          {rightIcon && (
            <div className="absolute inset-y-0 right-0 pr-3 flex items-center">{rightIcon}</div>
          )}
        </div>
        {error && <p className="text-xs text-rose-600 mt-1 font-medium">{error}</p>}
        {!error && helperText && <p className="text-xs text-slate-500 mt-1">{helperText}</p>}
      </div>
    );
  }
);

FormInput.displayName = 'FormInput';
