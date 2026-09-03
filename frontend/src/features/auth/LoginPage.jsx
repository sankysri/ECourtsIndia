import React, { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { useNavigate, useLocation } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { apiClient } from '../../api/client.js';
import { setAuthSuccess, setAuthLoading } from '../../store/slices/authSlice.js';
import { addToast } from '../../store/slices/notificationSlice.js';
import { FormInput } from '../../components/forms/FormInput.jsx';
import { PasswordInput } from '../../components/forms/PasswordInput.jsx';
import { FormCheckbox } from '../../components/forms/FormCheckbox.jsx';
import { Button } from '../../components/common/Button.jsx';
import { Scale, Mail, ShieldAlert, Key, HelpCircle, ArrowRight } from 'lucide-react';

const loginSchema = z.object({
  email: z.string().email('Please enter a valid email address'),
  password: z.string().min(6, 'Password must be at least 6 characters'),
  rememberMe: z.boolean().optional().default(false),
});

export const LoginPage = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const location = useLocation();
  const from = location.state?.from?.pathname || '/';

  const [errorMessage, setErrorMessage] = useState('');
  const [forgotModalOpen, setForgotModalOpen] = useState(false);

  const {
    register,
    handleSubmit,
    setValue,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: 'admin@ecourts.local',
      password: 'Admin@123456',
      rememberMe: false,
    },
  });

  const onSubmit = async (values) => {
    setErrorMessage('');
    dispatch(setAuthLoading(true));
    try {
      const res = await apiClient.post('/api/auth/login', values);
      dispatch(setAuthSuccess(res.data));
      dispatch(
        addToast({
          type: 'success',
          title: 'Welcome Back',
          message: `Authenticated as ${res.data.user.email}`,
        })
      );
      navigate(from, { replace: true });
    } catch (err) {
      setErrorMessage(
        err.message || err.error?.message || 'Authentication failed. Please verify credentials.'
      );
    } finally {
      dispatch(setAuthLoading(false));
    }
  };

  const handleQuickFill = (email, password) => {
    setValue('email', email);
    setValue('password', password);
    setErrorMessage('');
  };

  return (
    <div className="min-h-screen flex flex-col justify-center bg-slate-950 px-4 sm:px-6 lg:px-8 relative overflow-hidden font-sans">
      {/* Background Decorative Mesh */}
      <div className="absolute top-0 left-1/2 -translate-x-1/2 w-full max-w-7xl h-96 bg-gradient-to-b from-blue-900/20 via-blue-950/10 to-transparent pointer-events-none" />
      <div className="absolute -top-40 -left-40 w-96 h-96 bg-blue-600/10 rounded-full blur-3xl pointer-events-none" />
      <div className="absolute -bottom-40 -right-40 w-96 h-96 bg-indigo-600/10 rounded-full blur-3xl pointer-events-none" />

      <div className="sm:mx-auto sm:w-full sm:max-w-md relative z-10">
        {/* Brand Header */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-14 h-14 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white shadow-lg shadow-blue-500/25 mb-4 ring-8 ring-blue-950/50">
            <Scale className="w-8 h-8" />
          </div>
          <h1 className="text-2xl sm:text-3xl font-extrabold text-white tracking-tight">
            Nyaya<span className="text-blue-500">Data</span> Intelligence
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-slate-400">
            Indian Court Data Ingestion & Intelligence Platform
          </p>
        </div>

        {/* Login Card */}
        <div className="bg-white rounded-2xl p-6 sm:p-8 shadow-2xl border border-slate-800/20">
          <div className="mb-6">
            <h2 className="text-lg font-bold text-slate-900">Operator Sign In</h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Enter your authorized credentials to access platform pipelines
            </p>
          </div>

          {/* Error Alert */}
          {errorMessage && (
            <div className="mb-5 p-3.5 rounded-xl bg-rose-50 border border-rose-200 flex items-start gap-3 text-xs text-rose-700 animate-fadeIn">
              <ShieldAlert className="w-4 h-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <span className="font-semibold">Authentication Error:</span> {errorMessage}
              </div>
            </div>
          )}

          {/* Login Form */}
          <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
            <FormInput
              label="Email Address"
              type="email"
              placeholder="operator@ecourts.local"
              leftIcon={<Mail className="w-4 h-4" />}
              error={errors.email?.message}
              required
              {...register('email')}
            />

            <PasswordInput
              label="Password"
              placeholder="••••••••••••"
              error={errors.password?.message}
              required
              {...register('password')}
            />

            <div className="flex items-center justify-between pt-1">
              <FormCheckbox
                label="Remember session"
                {...register('rememberMe')}
              />
              <button
                type="button"
                onClick={() => setForgotModalOpen(true)}
                className="text-xs font-semibold text-blue-600 hover:text-blue-800 hover:underline"
              >
                Forgot password?
              </button>
            </div>

            <Button
              type="submit"
              variant="primary"
              size="lg"
              isLoading={isSubmitting}
              className="w-full mt-2 font-semibold"
              rightIcon={<ArrowRight className="w-4 h-4" />}
            >
              Sign In to Platform
            </Button>
          </form>

          {/* Quick Fill Seeded Accounts Selector */}
          <div className="mt-6 pt-5 border-t border-slate-100">
            <div className="flex items-center justify-between text-[11px] text-slate-400 mb-2.5">
              <span>Demo / Seeded Accounts:</span>
              <Key className="w-3.5 h-3.5 text-slate-400" />
            </div>
            <div className="grid grid-cols-3 gap-2">
              <button
                type="button"
                onClick={() => handleQuickFill('admin@ecourts.local', 'Admin@123456')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 text-left transition-colors text-[11px]"
              >
                <div className="font-bold text-slate-800">Super Admin</div>
                <div className="text-[9px] text-slate-400 truncate">admin@...</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('dataadmin@ecourts.local', 'DataAdmin@123456')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 text-left transition-colors text-[11px]"
              >
                <div className="font-bold text-slate-800">Data Admin</div>
                <div className="text-[9px] text-slate-400 truncate">dataadmin@...</div>
              </button>
              <button
                type="button"
                onClick={() => handleQuickFill('viewer@ecourts.local', 'Viewer@123456')}
                className="px-2.5 py-1.5 rounded-lg border border-slate-200 bg-slate-50 hover:bg-blue-50 hover:border-blue-200 text-left transition-colors text-[11px]"
              >
                <div className="font-bold text-slate-800">Read Only</div>
                <div className="text-[9px] text-slate-400 truncate">viewer@...</div>
              </button>
            </div>
          </div>
        </div>

        {/* Security Notice */}
        <p className="mt-6 text-center text-xs text-slate-500">
          Authorized personnel only. Audit logging is active for all session events.
        </p>
      </div>

      {/* Forgot Password Placeholder Modal */}
      {forgotModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs">
          <div className="bg-white rounded-2xl max-w-sm w-full p-6 text-center shadow-2xl border border-slate-200">
            <div className="w-12 h-12 rounded-full bg-blue-50 text-blue-600 flex items-center justify-center mx-auto mb-3">
              <HelpCircle className="w-6 h-6" />
            </div>
            <h3 className="font-bold text-slate-900 text-base mb-1">Password Recovery</h3>
            <p className="text-xs text-slate-600 mb-6 leading-relaxed">
              Self-service password recovery is managed via your Super Administrator. Please contact <code className="bg-slate-100 px-1 py-0.5 rounded text-blue-700">admin@ecourts.local</code>.
            </p>
            <Button
              variant="primary"
              size="sm"
              className="w-full"
              onClick={() => setForgotModalOpen(false)}
            >
              Understood
            </Button>
          </div>
        </div>
      )}
    </div>
  );
};
