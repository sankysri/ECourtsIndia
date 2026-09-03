import React, { useState, useEffect } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import { setGlobalSearchOpen } from '../../store/slices/uiSlice.js';
import {
  Search,
  Scale,
  Building2,
  FileText,
  RefreshCw,
  Sliders,
  AlertTriangle,
  ArrowRight,
  X,
} from 'lucide-react';

export const GlobalSearchModal = () => {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const isOpen = useSelector((state) => state.ui.globalSearchOpen);
  const [searchTerm, setSearchTerm] = useState('');

  // Global hotkey Ctrl+K / Cmd+K
  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        dispatch(setGlobalSearchOpen(!isOpen));
      }
      if (e.key === 'Escape' && isOpen) {
        dispatch(setGlobalSearchOpen(false));
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch, isOpen]);

  if (!isOpen) return null;

  const quickNavItems = [
    { title: 'Courts Registry', path: '/courts', icon: Building2, desc: 'District, High Courts & Tribunals' },
    { title: 'Case Intelligence', path: '/cases', icon: Scale, desc: 'CNR, Filing & Hearing Records' },
    { title: 'Case Discovery', path: '/discovery', icon: Search, desc: 'Automated scraping & discovery jobs' },
    { title: 'Sync Center', path: '/sync', icon: RefreshCw, desc: 'Active pipeline synchronization status' },
    { title: 'Judgments & Orders', path: '/documents', icon: FileText, desc: 'Document repository & S3 storage' },
    { title: 'API Usage & Rate Limits', path: '/api-usage', icon: Sliders, desc: 'eCourts API quotas & metrics' },
    { title: 'Sync Failures & DLQ', path: '/failures', icon: AlertTriangle, desc: 'Failed jobs & retry manager' },
  ];

  const filtered = quickNavItems.filter(
    (item) =>
      item.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.desc.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const handleSelect = (path) => {
    dispatch(setGlobalSearchOpen(false));
    navigate(path);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-20 p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-2xl max-w-xl w-full overflow-hidden">
        {/* Search Input Bar */}
        <div className="flex items-center px-4 py-3.5 border-b border-slate-200 bg-slate-50/50">
          <Search className="w-5 h-5 text-slate-400 mr-3 shrink-0" />
          <input
            type="text"
            placeholder="Search courts, CNR numbers, cases, or routes... (ESC to close)"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            autoFocus
            className="w-full bg-transparent text-sm text-slate-900 placeholder-slate-400 focus:outline-none"
          />
          <button
            onClick={() => dispatch(setGlobalSearchOpen(false))}
            className="p-1 text-slate-400 hover:text-slate-600 rounded-md"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Results / Navigation list */}
        <div className="p-3 max-h-[60vh] overflow-y-auto space-y-1">
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Quick Navigation & Resources
          </div>

          {filtered.length === 0 ? (
            <div className="p-6 text-center text-xs text-slate-500">
              No matching routes or records found for "{searchTerm}".
            </div>
          ) : (
            filtered.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.path}
                  onClick={() => handleSelect(item.path)}
                  className="w-full flex items-center justify-between p-2.5 rounded-xl hover:bg-slate-100 text-left transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center group-hover:bg-blue-600 group-hover:text-white transition-colors">
                      <Icon className="w-4 h-4" />
                    </div>
                    <div>
                      <div className="text-xs font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                        {item.title}
                      </div>
                      <div className="text-[11px] text-slate-500">{item.desc}</div>
                    </div>
                  </div>
                  <ArrowRight className="w-4 h-4 text-slate-300 group-hover:text-slate-600 transition-colors mr-1" />
                </button>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="px-4 py-2 bg-slate-50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-2">
            <span>Navigation:</span>
            <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px] text-slate-600 shadow-2xs">
              ↵ Enter
            </kbd>
            <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded font-mono text-[10px] text-slate-600 shadow-2xs">
              ESC
            </kbd>
          </div>
          <span>NyayaData Intelligence Search</span>
        </div>
      </div>
    </div>
  );
};
