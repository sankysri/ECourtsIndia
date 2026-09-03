import React from 'react';
import { useNavigate } from 'react-router-dom';
import { usePermissions } from '../../utils/usePermissions.js';
import { ShieldAlert, ArrowLeft, LayoutDashboard, Lock } from 'lucide-react';
import { Button } from './Button.jsx';
import { Badge } from './Badge.jsx';

export const UnauthorizedPage = ({ requiredPermission }) => {
  const navigate = useNavigate();
  const { role, user } = usePermissions();

  const getRoleBadgeVariant = (r) => {
    switch (r) {
      case 'SUPER_ADMIN':
        return 'purple';
      case 'DATA_ADMIN':
        return 'navy';
      default:
        return 'default';
    }
  };

  return (
    <div className="min-h-[70vh] flex items-center justify-center p-6 animate-fadeIn font-sans">
      <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 shadow-xl p-8 text-center relative overflow-hidden">
        {/* Glow accent */}
        <div className="absolute top-0 right-0 w-40 h-40 bg-rose-500/10 rounded-full blur-3xl pointer-events-none -mr-10 -mt-10"></div>
        <div className="absolute bottom-0 left-0 w-40 h-40 bg-blue-500/10 rounded-full blur-3xl pointer-events-none -ml-10 -mb-10"></div>

        <div className="relative z-10 space-y-5">
          {/* Icon Header */}
          <div className="w-16 h-16 rounded-2xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center mx-auto shadow-sm">
            <ShieldAlert className="w-8 h-8" />
          </div>

          <div className="space-y-2">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold bg-slate-100 text-slate-700 border border-slate-200">
              <Lock className="w-3 h-3 text-slate-500" />
              Access Restricted
            </div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
              Permission Required
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 leading-relaxed max-w-sm mx-auto">
              You don't have permission to access this area. Your current account profile does not possess the required access level for this resource.
            </p>
          </div>

          {/* User Account Context Box */}
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 text-xs flex items-center justify-between">
            <div className="text-left truncate mr-2">
              <div className="text-[10px] uppercase font-semibold text-slate-400">Authenticated User</div>
              <div className="font-semibold text-slate-800 truncate">{user?.email || 'Active Session'}</div>
            </div>
            <Badge variant={getRoleBadgeVariant(role)} size="sm">
              Role: {role}
            </Badge>
          </div>

          {/* Action Buttons */}
          <div className="pt-2 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button
              variant="primary"
              size="md"
              className="w-full sm:w-auto"
              onClick={() => navigate('/')}
              leftIcon={<LayoutDashboard className="w-4 h-4" />}
            >
              Go to Dashboard
            </Button>
            <Button
              variant="outline"
              size="md"
              className="w-full sm:w-auto"
              onClick={() => navigate(-1)}
              leftIcon={<ArrowLeft className="w-4 h-4" />}
            >
              Go Back
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
};
