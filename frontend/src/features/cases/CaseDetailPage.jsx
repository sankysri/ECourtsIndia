import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useDispatch } from 'react-redux';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.js';
import { Card, CardHeader } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { addToast } from '../../store/slices/notificationSlice.js';
import { PermissionGuard } from '../../components/common/PermissionGuard.jsx';
import { usePermissions } from '../../utils/usePermissions.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import {
  Scale,
  ChevronRight,
  ArrowLeft,
  Users,
  Briefcase,
  Gavel,
  Calendar,
  FileText,
  Clock,
  Code2,
  RefreshCw,
  Building2,
  MapPin,
  Shield,
  Download,
  Copy,
  CheckCircle2,
  AlertCircle,
  ExternalLink,
} from 'lucide-react';

export const CaseDetailPage = () => {
  const { cnr } = useParams();
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState('overview');
  const [copiedRaw, setCopiedRaw] = useState(false);

  const canViewRaw = hasPermission(PERMISSIONS.VIEW_RAW_API_DATA);

  // 1. Fetch Complete Case Dossier
  const {
    data: caseData,
    isLoading: caseLoading,
    error: caseError,
  } = useQuery({
    queryKey: ['caseDetail', cnr],
    queryFn: async () => {
      const res = await apiClient.get(`/api/cases/${cnr}`);
      return res.data;
    },
  });

  // 2. Fetch Raw API Source (if tab active and user authorized)
  const { data: rawSourceData, isLoading: rawLoading } = useQuery({
    queryKey: ['caseRawSource', cnr],
    queryFn: async () => {
      const res = await apiClient.get(`/api/cases/${cnr}/raw`);
      return res.data.raw;
    },
    enabled: activeTab === 'raw' && canViewRaw,
  });

  // Sync Mutation
  const syncMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post(`/api/cases/${cnr}/sync`);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['caseDetail', cnr] });
      queryClient.invalidateQueries({ queryKey: ['caseRawSource', cnr] });
      dispatch(
        addToast({
          type: 'success',
          title: 'Case Detail Ingested',
          message: `Case ${cnr} synchronized successfully.`,
        })
      );
    },
    onError: (err) => {
      dispatch(
        addToast({
          type: 'error',
          title: 'Sync Failed',
          message: err.message || 'Could not synchronize case details',
        })
      );
    },
  });

  const handleCopyRaw = () => {
    if (rawSourceData?.raw_payload) {
      navigator.clipboard.writeText(JSON.stringify(rawSourceData.raw_payload, null, 2));
      setCopiedRaw(true);
      setTimeout(() => setCopiedRaw(false), 2000);
      dispatch(addToast({ type: 'info', title: 'Copied', message: 'Raw JSON payload copied to clipboard' }));
    }
  };

  if (caseLoading) {
    return (
      <div className="py-24 text-center text-xs text-slate-500 space-y-3">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600 mx-auto" />
        <p>Ingesting case dossier and judicial timeline...</p>
      </div>
    );
  }

  if (caseError || !caseData?.case) {
    return (
      <div className="py-20 text-center space-y-4">
        <p className="text-sm font-semibold text-rose-600">Case dossier not found for CNR: {cnr}</p>
        <div className="flex justify-center gap-3">
          <Button variant="outline" size="sm" onClick={() => navigate('/cases')} leftIcon={<ArrowLeft className="w-3.5 h-3.5" />}>
            Back to Cases
          </Button>
          <Button
            variant="primary"
            size="sm"
            isLoading={syncMutation.isPending}
            onClick={() => syncMutation.mutate()}
            leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
          >
            Fetch from eCourts API
          </Button>
        </div>
      </div>
    );
  }

  const c = caseData.case;
  const auditLogs = caseData.auditLogs || [];

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans">
      {/* Breadcrumbs */}
      <div className="flex items-center gap-2 text-xs text-slate-500">
        <Link to="/cases" className="hover:text-blue-600 font-medium transition-colors">
          Cases Dossier
        </Link>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-slate-700 font-mono">{c.court_code}</span>
        <ChevronRight className="w-3.5 h-3.5 text-slate-300" />
        <span className="text-slate-900 font-semibold font-mono">{c.cnr}</span>
      </div>

      {/* Case Header Card */}
      <Card className="p-6 bg-white border border-slate-200/80 shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-blue-50 text-blue-700 flex items-center justify-center shrink-0 shadow-2xs">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2.5">
                <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
                  {c.case_number || c.cnr}
                </h1>
                <Badge variant={c.case_type === 'WP' ? 'purple' : 'navy'} size="sm">
                  {c.case_type}
                </Badge>
                <Badge variant={c.case_status === 'DISPOSED' ? 'default' : 'success'} size="sm" dot>
                  {c.case_status}
                </Badge>
                {c.next_hearing_date && (
                  <div className="px-2.5 py-0.5 rounded-full bg-blue-50 border border-blue-200 text-blue-800 text-[11px] font-semibold flex items-center gap-1.5">
                    <Calendar className="w-3 h-3 text-blue-600" />
                    Next: {new Date(c.next_hearing_date).toLocaleDateString()}
                  </div>
                )}
              </div>

              <div className="text-slate-700 font-medium text-xs mt-1.5 line-clamp-1">
                {c.title}
              </div>

              <div className="flex flex-wrap items-center gap-4 text-xs text-slate-500 mt-2 font-mono">
                <span>CNR: <strong className="text-slate-800">{c.cnr}</strong></span>
                <span>•</span>
                <span>Court: <strong className="text-slate-800">{c.court_name}</strong></span>
                <span>•</span>
                <span>Filing Date: <strong className="text-slate-800">{c.filing_date ? new Date(c.filing_date).toLocaleDateString() : 'N/A'}</strong></span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2.5 self-start lg:self-center">
            <PermissionGuard permission={PERMISSIONS.START_SYNC}>
              <Button
                variant="outline"
                size="sm"
                isLoading={syncMutation.isPending}
                onClick={() => syncMutation.mutate()}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Sync Details
              </Button>
            </PermissionGuard>
          </div>
        </div>
      </Card>

      {/* 8 Tab Navigation */}
      <div className="flex items-center gap-2 border-b border-slate-200 text-xs font-bold overflow-x-auto">
        <button
          onClick={() => setActiveTab('overview')}
          className={`pb-3 px-3 transition-all border-b-2 shrink-0 ${
            activeTab === 'overview' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Scale className="w-4 h-4" />
            Overview
          </div>
        </button>

        <button
          onClick={() => setActiveTab('parties')}
          className={`pb-3 px-3 transition-all border-b-2 shrink-0 ${
            activeTab === 'parties' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4" />
            Parties ({c.parties?.length || 0})
          </div>
        </button>

        <button
          onClick={() => setActiveTab('advocates')}
          className={`pb-3 px-3 transition-all border-b-2 shrink-0 ${
            activeTab === 'advocates' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Briefcase className="w-4 h-4" />
            Advocates ({c.advocates?.length || 0})
          </div>
        </button>

        <button
          onClick={() => setActiveTab('judges')}
          className={`pb-3 px-3 transition-all border-b-2 shrink-0 ${
            activeTab === 'judges' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Gavel className="w-4 h-4" />
            Judges ({c.judges?.length || 0})
          </div>
        </button>

        <button
          onClick={() => setActiveTab('hearings')}
          className={`pb-3 px-3 transition-all border-b-2 shrink-0 ${
            activeTab === 'hearings' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Calendar className="w-4 h-4" />
            Hearings ({c.hearings?.length || 0})
          </div>
        </button>

        <button
          onClick={() => setActiveTab('orders')}
          className={`pb-3 px-3 transition-all border-b-2 shrink-0 ${
            activeTab === 'orders' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <FileText className="w-4 h-4" />
            Orders & Judgments ({c.orders?.length || 0})
          </div>
        </button>

        <button
          onClick={() => setActiveTab('history')}
          className={`pb-3 px-3 transition-all border-b-2 shrink-0 ${
            activeTab === 'history' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Change History ({auditLogs.length})
          </div>
        </button>

        {canViewRaw && (
          <button
            onClick={() => setActiveTab('raw')}
            className={`pb-3 px-3 transition-all border-b-2 shrink-0 ${
              activeTab === 'raw' ? 'border-blue-600 text-blue-600' : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Code2 className="w-4 h-4" />
              Raw Source
            </div>
          </button>
        )}
      </div>

      {/* TAB 1: OVERVIEW */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card className="md:col-span-2 space-y-4">
            <CardHeader title="Case Registry Information" subtitle="Official registration and filing parameters" />

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Filing Number</span>
                <div className="text-xs font-mono font-bold text-slate-900 mt-1">{c.filing_number || 'N/A'}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Filing Date</span>
                <div className="text-xs font-mono font-bold text-slate-900 mt-1">{c.filing_date || 'N/A'}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Registration Number</span>
                <div className="text-xs font-mono font-bold text-slate-900 mt-1">{c.registration_number || c.case_number}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Registration Date</span>
                <div className="text-xs font-mono font-bold text-slate-900 mt-1">{c.registration_date || 'N/A'}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">First Hearing Date</span>
                <div className="text-xs font-mono font-bold text-slate-900 mt-1">{c.first_hearing_date || 'N/A'}</div>
              </div>

              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
                <span className="text-slate-400 font-semibold uppercase text-[10px]">Case Status</span>
                <div className="text-xs font-bold text-slate-900 mt-1">{c.case_status}</div>
              </div>
            </div>

            {/* Acts & Sections */}
            <div className="p-4 bg-blue-50/60 rounded-xl border border-blue-100 space-y-2 text-xs">
              <div className="font-bold text-blue-900 uppercase text-[10px] tracking-wider">Applicable Acts & Sections</div>
              <p className="text-blue-950 font-medium leading-relaxed">{c.under_acts || 'N/A'}</p>
              {c.under_sections && (
                <p className="text-blue-800 text-[11px] font-mono">Sections: {c.under_sections}</p>
              )}
            </div>

            {/* Police Station & FIR */}
            {c.police_station && (
              <div className="p-3 bg-slate-50 rounded-xl border border-slate-200 text-xs space-y-1">
                <span className="font-bold text-slate-700 text-[11px]">Police Station & FIR Details:</span>
                <p className="text-slate-600">
                  {c.police_station} • FIR: <strong>{c.fir_number || 'N/A'}</strong> (Year: {c.fir_year || 'N/A'})
                </p>
              </div>
            )}
          </Card>

          {/* Side Telemetry */}
          <Card className="space-y-4">
            <CardHeader title="Court Jurisdiction" subtitle="Establishment details" />

            <div className="space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Court Name:</span>
                <span className="font-bold text-slate-800 text-right">{c.court_name}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Complex Code:</span>
                <span className="font-mono text-slate-800">{c.court_code}</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">State / UT:</span>
                <span className="font-semibold text-slate-800">{c.state_name} ({c.state_code})</span>
              </div>

              <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                <span className="text-slate-500">Court Type:</span>
                <Badge variant="navy" size="sm">{c.court_type}</Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-slate-500">Last Synced:</span>
                <span className="font-mono text-slate-600 text-[11px]">{new Date(c.updated_at).toLocaleString()}</span>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: PARTIES */}
      {activeTab === 'parties' && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-xs">
          {/* Petitioners */}
          <Card className="space-y-3">
            <CardHeader
              title="Petitioners / Complainants"
              subtitle="Aggrieved parties / Appellants"
              badge={<Badge variant="info" size="sm">Petitioners</Badge>}
            />
            <div className="space-y-2.5">
              {c.parties?.filter((p) => p.party_type === 'PETITIONER').map((p, idx) => (
                <div key={p.id || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{p.party_number}. {p.name}</span>
                    {p.gender && <Badge variant="default" size="sm">{p.gender}</Badge>}
                  </div>
                  {p.address && <p className="text-slate-500 text-[11px]">{p.address}</p>}
                </div>
              ))}
            </div>
          </Card>

          {/* Respondents */}
          <Card className="space-y-3">
            <CardHeader
              title="Respondents / Opponents"
              subtitle="Defending parties / State authorities"
              badge={<Badge variant="warning" size="sm">Respondents</Badge>}
            />
            <div className="space-y-2.5">
              {c.parties?.filter((p) => p.party_type === 'RESPONDENT').map((p, idx) => (
                <div key={p.id || idx} className="p-3 bg-slate-50 rounded-xl border border-slate-200/80 space-y-1">
                  <div className="flex items-center justify-between">
                    <span className="font-bold text-slate-900">{p.party_number}. {p.name}</span>
                    {p.gender && <Badge variant="default" size="sm">{p.gender}</Badge>}
                  </div>
                  {p.address && <p className="text-slate-500 text-[11px]">{p.address}</p>}
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 3: ADVOCATES */}
      {activeTab === 'advocates' && (
        <Card className="space-y-4">
          <CardHeader title="Legal Counsel & Advocates Roster" subtitle="Attorneys of record representing parties" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {c.advocates?.map((a, idx) => (
              <div key={a.id || idx} className="p-3.5 bg-slate-50 rounded-xl border border-slate-200/80 flex items-start justify-between">
                <div className="space-y-1">
                  <div className="font-bold text-slate-900">{a.name}</div>
                  <div className="font-mono text-[11px] text-slate-500">
                    Bar Reg: {a.bar_registration_number || 'Enrolled Advocate'}
                  </div>
                  {a.email && <div className="text-[11px] text-blue-600">{a.email}</div>}
                  {a.phone && <div className="text-[11px] text-slate-500 font-mono">{a.phone}</div>}
                </div>
                <Badge variant={a.party_type === 'PETITIONER' ? 'info' : 'warning'} size="sm">
                  {a.party_type} {a.is_lead ? '• Lead Counsel' : ''}
                </Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 4: JUDGES */}
      {activeTab === 'judges' && (
        <Card className="space-y-4">
          <CardHeader title="Bench & Coram Composition" subtitle="Presiding judicial officers" />

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            {c.judges?.map((j, idx) => (
              <div key={j.id || idx} className="p-4 bg-slate-50 rounded-xl border border-slate-200/80 flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-lg bg-blue-100 text-blue-700 flex items-center justify-center">
                    <Gavel className="w-4 h-4" />
                  </div>
                  <div>
                    <div className="font-bold text-slate-900">{j.name}</div>
                    <div className="text-slate-500 text-[11px]">{j.designation || 'Hon\'ble Justice'}</div>
                  </div>
                </div>
                <Badge variant="purple" size="sm">{j.role || 'PRESIDING'}</Badge>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 5: HEARINGS */}
      {activeTab === 'hearings' && (
        <Card className="space-y-4">
          <CardHeader title="Case Hearing History & Proceedings" subtitle="Chronological record of court sessions" />

          <div className="divide-y divide-slate-100 text-xs">
            {c.hearings?.map((h, idx) => (
              <div key={h.id || idx} className="py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold text-slate-900">{new Date(h.hearing_date).toLocaleDateString()}</span>
                    <span className="text-slate-400">•</span>
                    <span className="font-semibold text-slate-800">{h.business_purpose}</span>
                  </div>
                  <div className="text-[11px] text-slate-500">
                    {h.court_hall_number} • Bench: {h.judge_name}
                  </div>
                </div>

                {h.next_hearing_date && (
                  <div className="text-right shrink-0">
                    <span className="text-[10px] text-slate-400 uppercase font-semibold">Next Date:</span>
                    <div className="font-mono font-bold text-blue-700">
                      {new Date(h.next_hearing_date).toLocaleDateString()}
                    </div>
                    {h.next_purpose && (
                      <div className="text-[10px] text-slate-500">{h.next_purpose}</div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 6: ORDERS */}
      {activeTab === 'orders' && (
        <Card className="space-y-4">
          <CardHeader title="Orders & Judicial Decrees" subtitle="Issued interim and final court directions" />

          <div className="divide-y divide-slate-100 text-xs">
            {c.orders?.map((o, idx) => (
              <div key={o.id || idx} className="py-3 flex items-center justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-slate-900">Order #{o.order_number}</span>
                    <Badge variant="navy" size="sm">{o.order_type}</Badge>
                    <span className="font-mono text-slate-500 text-[11px]">
                      {new Date(o.order_date).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="text-[11px] text-slate-500 mt-0.5">
                    Passed by {o.judge_name}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <a
                    href={o.document_url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-slate-700 font-semibold transition-colors"
                  >
                    <FileText className="w-3.5 h-3.5 text-blue-600" />
                    View PDF
                  </a>
                </div>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* TAB 7: AUDIT HISTORY */}
      {activeTab === 'history' && (
        <Card className="space-y-4">
          <CardHeader title="Case Revision & Sync Audit Trail" subtitle="Platform log of changes and worker runs" />

          <div className="divide-y divide-slate-100 text-xs">
            {!auditLogs.length ? (
              <div className="p-6 text-center text-slate-400">No audit revisions recorded yet.</div>
            ) : (
              auditLogs.map((log) => (
                <div key={log.id} className="py-2.5 flex items-center justify-between">
                  <div>
                    <span className="font-bold text-slate-900">{log.action}</span>
                    <span className="text-slate-400 text-[11px] ml-2 font-mono">
                      by {log.user_email || 'System Worker'}
                    </span>
                  </div>
                  <span className="font-mono text-slate-500 text-[11px]">
                    {new Date(log.created_at).toLocaleString()}
                  </span>
                </div>
              ))
            )}
          </div>
        </Card>
      )}

      {/* TAB 8: RAW SOURCE (Admin only) */}
      {activeTab === 'raw' && canViewRaw && (
        <Card className="space-y-4">
          <div className="flex items-center justify-between">
            <CardHeader
              title="Raw Upstream API Payload"
              subtitle="Verbatim JSON archived in raw_api_responses"
              badge={<Badge variant="navy" size="sm">SHA256 Verified</Badge>}
            />
            <Button
              variant="outline"
              size="sm"
              onClick={handleCopyRaw}
              leftIcon={copiedRaw ? <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
            >
              {copiedRaw ? 'Copied' : 'Copy JSON'}
            </Button>
          </div>

          <div className="p-4 bg-slate-900 text-slate-200 rounded-xl overflow-x-auto font-mono text-[11px] max-h-96">
            {rawLoading ? (
              <div className="text-slate-400">Loading archived payload...</div>
            ) : (
              <pre>{JSON.stringify(rawSourceData?.raw_payload || {}, null, 2)}</pre>
            )}
          </div>
        </Card>
      )}
    </div>
  );
};
