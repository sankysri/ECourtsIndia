import React from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { closeContextPanel } from '../../store/slices/uiSlice.js';
import { X, Layers, Activity, Sliders, Shield } from 'lucide-react';
import { Button } from '../common/Button.jsx';
import { Badge } from '../common/Badge.jsx';

export const ContextPanel = () => {
  const dispatch = useDispatch();
  const { contextPanelOpen, contextPanelContent } = useSelector((state) => state.ui);

  if (!contextPanelOpen || !contextPanelContent) return null;

  return (
    <div className="fixed inset-y-0 right-0 z-40 w-80 sm:w-96 bg-white border-l border-slate-200 shadow-2xl flex flex-col animate-slideLeft">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-slate-100 bg-slate-50/70">
        <div className="flex items-center gap-2">
          <Layers className="w-5 h-5 text-blue-600" />
          <h4 className="font-bold text-sm text-slate-900">
            {contextPanelContent.title || 'Context Inspector'}
          </h4>
        </div>
        <button
          onClick={() => dispatch(closeContextPanel())}
          className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-200/60 rounded-lg transition-colors"
        >
          <X className="w-4 h-4" />
        </button>
      </div>

      {/* Content */}
      <div className="flex-1 p-5 overflow-y-auto space-y-4 text-xs">
        {contextPanelContent.description && (
          <p className="text-slate-600 leading-relaxed">
            {contextPanelContent.description}
          </p>
        )}

        {contextPanelContent.data && (
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 font-mono text-[11px] overflow-x-auto">
            <pre className="text-slate-800">
              {JSON.stringify(contextPanelContent.data, null, 2)}
            </pre>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="p-4 border-t border-slate-100 bg-slate-50 flex justify-end">
        <Button size="sm" variant="outline" onClick={() => dispatch(closeContextPanel())}>
          Close Panel
        </Button>
      </div>
    </div>
  );
};
