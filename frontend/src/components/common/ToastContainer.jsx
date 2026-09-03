import React, { useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { motion, AnimatePresence } from 'framer-motion';
import { CheckCircle, AlertTriangle, AlertCircle, Info, X } from 'lucide-react';
import { removeToast } from '../../store/slices/notificationSlice.js';

export const ToastContainer = () => {
  const dispatch = useDispatch();
  const toasts = useSelector((state) => state.notifications.toasts);

  return (
    <div className="fixed bottom-5 right-5 z-50 flex flex-col gap-2.5 max-w-sm w-full pointer-events-none">
      <AnimatePresence>
        {toasts.map((toast) => (
          <ToastItem
            key={toast.id}
            toast={toast}
            onClose={() => dispatch(removeToast(toast.id))}
          />
        ))}
      </AnimatePresence>
    </div>
  );
};

const ToastItem = ({ toast, onClose }) => {
  useEffect(() => {
    if (toast.duration) {
      const timer = setTimeout(onClose, toast.duration);
      return () => clearTimeout(timer);
    }
  }, [toast, onClose]);

  const icons = {
    success: <CheckCircle className="w-5 h-5 text-emerald-600 shrink-0" />,
    error: <AlertCircle className="w-5 h-5 text-rose-600 shrink-0" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-600 shrink-0" />,
    info: <Info className="w-5 h-5 text-blue-600 shrink-0" />,
  };

  const borderColors = {
    success: 'border-emerald-200 bg-white',
    error: 'border-rose-200 bg-white',
    warning: 'border-amber-200 bg-white',
    info: 'border-blue-200 bg-white',
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, scale: 0.95, transition: { duration: 0.15 } }}
      className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-elevated ${borderColors[toast.type || 'info']}`}
    >
      {icons[toast.type || 'info']}
      <div className="flex-1 min-w-0">
        {toast.title && <h5 className="text-sm font-semibold text-slate-900">{toast.title}</h5>}
        <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{toast.message}</p>
      </div>
      <button
        onClick={onClose}
        className="text-slate-400 hover:text-slate-600 rounded-md p-1 hover:bg-slate-100 transition-colors"
      >
        <X className="w-4 h-4" />
      </button>
    </motion.div>
  );
};
