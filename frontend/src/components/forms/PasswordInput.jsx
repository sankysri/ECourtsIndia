import React, { useState } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import { FormInput } from './FormInput.jsx';

export const PasswordInput = React.forwardRef(
  ({ label = 'Password', name = 'password', error, ...props }, ref) => {
    const [showPassword, setShowPassword] = useState(false);

    return (
      <FormInput
        ref={ref}
        name={name}
        label={label}
        type={showPassword ? 'text' : 'password'}
        leftIcon={<Lock className="w-4 h-4" />}
        rightIcon={
          <button
            type="button"
            onClick={() => setShowPassword(!showPassword)}
            className="text-slate-400 hover:text-slate-600 focus:outline-none p-1"
            title={showPassword ? 'Hide password' : 'Show password'}
          >
            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
          </button>
        }
        error={error}
        {...props}
      />
    );
  }
);

PasswordInput.displayName = 'PasswordInput';
