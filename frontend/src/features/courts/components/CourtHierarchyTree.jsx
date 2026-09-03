import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Building2,
  ChevronDown,
  ChevronRight,
  MapPin,
  Scale,
  ExternalLink,
  Shield,
  Layers,
} from 'lucide-react';
import { Badge } from '../../../components/common/Badge.jsx';
import { Button } from '../../../components/common/Button.jsx';

export const CourtHierarchyTree = ({ hierarchy = [] }) => {
  const [expandedStates, setExpandedStates] = useState({});
  const [expandedDistricts, setExpandedDistricts] = useState({});
  const navigate = useNavigate();

  const toggleState = (stateId) => {
    setExpandedStates((prev) => ({ ...prev, [stateId]: !prev[stateId] }));
  };

  const toggleDistrict = (distId) => {
    setExpandedDistricts((prev) => ({ ...prev, [distId]: !prev[distId] }));
  };

  if (!hierarchy.length) {
    return (
      <div className="p-8 text-center text-xs text-slate-500 bg-white rounded-xl border border-slate-200">
        No court hierarchy records found. Click <strong>"Sync Courts"</strong> to populate national jurisdictions.
      </div>
    );
  }

  return (
    <div className="space-y-3 font-sans">
      {hierarchy.map((state) => {
        const isStateOpen = Boolean(expandedStates[state.id]);

        return (
          <div
            key={state.id}
            className="bg-white rounded-xl border border-slate-200/80 shadow-card overflow-hidden transition-all"
          >
            {/* State Node Header */}
            <div
              onClick={() => toggleState(state.id)}
              className="flex items-center justify-between p-4 cursor-pointer hover:bg-slate-50/80 transition-colors select-none"
            >
              <div className="flex items-center gap-3">
                <button className="p-1 rounded-md text-slate-400 hover:text-slate-700">
                  {isStateOpen ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
                </button>
                <div className="w-8 h-8 rounded-lg bg-blue-50 text-blue-700 font-bold text-xs flex items-center justify-center">
                  {state.code}
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">{state.name}</h3>
                  <div className="text-[11px] text-slate-500">
                    {state.districts?.length || 0} Judicial Districts • {state.totalCourts || 0} Total Courts
                  </div>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant="navy" size="sm">
                  {state.highCourts?.length ? 'High Court State' : 'State UT'}
                </Badge>
              </div>
            </div>

            {/* State Children (High Courts & Districts) */}
            {isStateOpen && (
              <div className="border-t border-slate-100 bg-slate-50/40 p-4 pl-8 space-y-3 text-xs">
                {/* High Courts Section */}
                {state.highCourts?.length > 0 && (
                  <div className="space-y-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-blue-900 flex items-center gap-1.5">
                      <Scale className="w-3.5 h-3.5 text-blue-600" /> High Court Benches ({state.highCourts.length})
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {state.highCourts.map((hc) => (
                        <div
                          key={hc.id || hc.code}
                          onClick={() => hc.id && navigate(`/courts/${hc.id}`)}
                          className="p-3 bg-white rounded-lg border border-blue-100 hover:border-blue-300 hover:shadow-xs cursor-pointer transition-all flex items-center justify-between group"
                        >
                          <div>
                            <div className="font-semibold text-slate-900 group-hover:text-blue-600 transition-colors">
                              {hc.name}
                            </div>
                            <div className="font-mono text-[10px] text-slate-400">{hc.code}</div>
                          </div>
                          <Badge variant="purple" size="sm">High Court</Badge>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* District Complex Hierarchy */}
                {state.districts?.length > 0 && (
                  <div className="space-y-2 pt-2">
                    <div className="text-[11px] font-bold uppercase tracking-wider text-slate-500 flex items-center gap-1.5">
                      <MapPin className="w-3.5 h-3.5 text-slate-400" /> District Jurisdictions ({state.districts.length})
                    </div>

                    <div className="space-y-2">
                      {state.districts.map((dist) => {
                        const isDistOpen = Boolean(expandedDistricts[dist.id]);

                        return (
                          <div
                            key={dist.id}
                            className="bg-white rounded-lg border border-slate-200 overflow-hidden"
                          >
                            <div
                              onClick={() => toggleDistrict(dist.id)}
                              className="p-3 flex items-center justify-between cursor-pointer hover:bg-slate-50 transition-colors select-none"
                            >
                              <div className="flex items-center gap-2">
                                <button className="p-0.5 text-slate-400">
                                  {isDistOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
                                </button>
                                <span className="font-semibold text-slate-800">{dist.name}</span>
                                <span className="font-mono text-[10px] text-slate-400">({dist.code})</span>
                              </div>
                              <span className="text-[11px] text-slate-500 font-mono">
                                {dist.courtCount} Establishments
                              </span>
                            </div>

                            {/* Subordinate Courts */}
                            {isDistOpen && (
                              <div className="p-3 bg-slate-50/70 border-t border-slate-100 divide-y divide-slate-100 pl-6">
                                {dist.courts?.map((court) => (
                                  <div
                                    key={court.id || court.code}
                                    onClick={() => court.id && navigate(`/courts/${court.id}`)}
                                    className="py-2 flex items-center justify-between hover:text-blue-600 cursor-pointer transition-colors"
                                  >
                                    <div>
                                      <div className="font-medium text-slate-900 text-xs">
                                        {court.name}
                                      </div>
                                      <div className="font-mono text-[10px] text-slate-400">
                                        {court.code} • {court.type}
                                      </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                      <Badge variant="default" size="sm">
                                        {court.status || 'ACTIVE'}
                                      </Badge>
                                      <ExternalLink className="w-3 h-3 text-slate-400" />
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};
