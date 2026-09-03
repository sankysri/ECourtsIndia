import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../../api/client.js';
import { Card, CardHeader } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { Button } from '../../components/common/Button.jsx';
import { PermissionGuard } from '../../components/common/PermissionGuard.jsx';
import { usePermissions } from '../../utils/usePermissions.js';
import { PERMISSIONS } from '../../constants/permissions.js';
import { useDispatch } from 'react-redux';
import { addToast } from '../../store/slices/notificationSlice.js';
import {
  Settings as SettingsIcon,
  Shield,
  Clock,
  Database,
  Sliders,
  Save,
  RefreshCw,
  User,
  Key,
  Trash2,
  AlertTriangle,
  Globe,
  Radio,
  CheckCircle2,
} from 'lucide-react';

export const SettingsPage = () => {
  const dispatch = useDispatch();
  const queryClient = useQueryClient();
  const { user, role, isSuperAdmin, hasPermission } = usePermissions();
  const [activeTab, setActiveTab] = useState('config'); // 'config' | 'audit' | 'roles'
  const [purgeModalOpen, setPurgeModalOpen] = useState(false);

  // Settings Query
  const { data: settingsData, isLoading: settingsLoading, refetch: refetchSettings } = useQuery({
    queryKey: ['systemSettings'],
    queryFn: async () => {
      const res = await apiClient.get('/api/settings/config');
      return res.data.settings || [];
    },
    enabled: hasPermission(PERMISSIONS.VIEW_SETTINGS),
  });

  // Audit Logs Query
  const { data: auditData, isLoading: auditLoading, refetch: refetchAudit } = useQuery({
    queryKey: ['auditLogs'],
    queryFn: async () => {
      const res = await apiClient.get('/api/settings/audit-logs?limit=50');
      return res.data.logs || [];
    },
    enabled: activeTab === 'audit' && hasPermission(PERMISSIONS.VIEW_AUDIT_LOGS),
  });

  // Update Setting Mutation
  const updateSettingMutation = useMutation({
    mutationFn: async ({ key, value, description }) => {
      const res = await apiClient.put('/api/settings/config', { key, value, description });
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['systemSettings'] });
      dispatch(
        addToast({
          type: 'success',
          title: 'Setting Updated',
          message: `Updated configuration key: ${data.setting?.key}`,
        })
      );
    },
    onError: (err) => {
      dispatch(
        addToast({
          type: 'error',
          title: 'Update Failed',
          message: err.message || 'Could not update setting',
        })
      );
    },
  });

  // Purge Operational Dummy Data Mutation
  const purgeMutation = useMutation({
    mutationFn: async () => {
      const res = await apiClient.post('/api/settings/purge-data');
      return res.data;
    },
    onSuccess: (data) => {
      setPurgeModalOpen(false);
      queryClient.invalidateQueries();
      dispatch(
        addToast({
          type: 'success',
          title: 'Operational Data Purged',
          message: 'All dummy cases, discovery jobs, and docket logs have been cleared. Platform is ready for real API ingestion.',
        })
      );
    },
    onError: (err) => {
      dispatch(
        addToast({
          type: 'error',
          title: 'Purge Failed',
          message: err.message || 'Could not purge operational data',
        })
      );
    },
  });

  const canManageSettings = hasPermission(PERMISSIONS.MANAGE_SETTINGS);
  const canViewAuditLogs = hasPermission(PERMISSIONS.VIEW_AUDIT_LOGS);

  const getSettingValue = (key, fallback = '') => {
    const s = settingsData?.find((item) => item.key === key);
    return s ? s.value : fallback;
  };

  const isMockAdapter = getSettingValue('ecourts_use_mock', false);

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Platform Configuration & Audit Trail
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Manage system settings, configure upstream API credentials, and manage database state
          </p>
        </div>

        <div className="flex items-center gap-2">
          <Badge variant={isSuperAdmin ? 'purple' : role === 'DATA_ADMIN' ? 'navy' : 'default'} size="md">
            Role: {role}
          </Badge>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-slate-200">
        <button
          onClick={() => setActiveTab('config')}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'config'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Sliders className="w-4 h-4" />
            System Settings & API
          </div>
        </button>

        {canViewAuditLogs && (
          <button
            onClick={() => setActiveTab('audit')}
            className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 ${
              activeTab === 'audit'
                ? 'border-blue-600 text-blue-600'
                : 'border-transparent text-slate-500 hover:text-slate-800'
            }`}
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4" />
              Audit Trail
            </div>
          </button>
        )}

        <button
          onClick={() => setActiveTab('roles')}
          className={`pb-3 px-3 text-xs font-bold transition-all border-b-2 ${
            activeTab === 'roles'
              ? 'border-blue-600 text-blue-600'
              : 'border-transparent text-slate-500 hover:text-slate-800'
          }`}
        >
          <div className="flex items-center gap-2">
            <Shield className="w-4 h-4" />
            Roles & Permissions Matrix
          </div>
        </button>
      </div>

      {/* TAB 1: System Settings */}
      {activeTab === 'config' && (
        <div className="space-y-6">
          {/* Live eCourts API Ingestion Mode Card */}
          <Card className="p-5 border-blue-200 bg-gradient-to-tr from-blue-50/40 via-white to-indigo-50/20 shadow-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-4 border-b border-blue-100">
              <div className="flex items-start gap-3">
                <div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center shrink-0 shadow-xs">
                  <Globe className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-bold text-slate-900 text-sm">Upstream eCourts API Integration</h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    Configure live eCourts India API credentials for real-time docket ingestion and discovery
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <Badge variant={isMockAdapter ? 'warning' : 'success'} size="md" dot>
                  {isMockAdapter ? 'Mock Simulation Mode' : 'Live Real-Time API Mode'}
                </Badge>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-4 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">Upstream API Base URL</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    defaultValue={getSettingValue('ecourts_api_base_url', 'https://api.ecourts.gov.in/v1')}
                    onBlur={(e) => {
                      if (canManageSettings && e.target.value !== getSettingValue('ecourts_api_base_url')) {
                        updateSettingMutation.mutate({
                          key: 'ecourts_api_base_url',
                          value: e.target.value,
                          description: 'Upstream eCourts REST API Base URL',
                        });
                      }
                    }}
                    placeholder="https://api.ecourts.gov.in/v1"
                    disabled={!canManageSettings}
                    className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:bg-slate-100"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">eCourts API Key</label>
                <input
                  type="password"
                  defaultValue={getSettingValue('ecourts_api_key', '')}
                  onBlur={(e) => {
                    if (canManageSettings && e.target.value !== getSettingValue('ecourts_api_key')) {
                      updateSettingMutation.mutate({
                        key: 'ecourts_api_key',
                        value: e.target.value,
                        description: 'Production eCourts API Secret Key',
                      });
                    }
                  }}
                  placeholder="Paste your production eCourts API key here"
                  disabled={!canManageSettings}
                  className="w-full px-3 py-2 bg-white border border-slate-200 rounded-lg font-mono text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500/20 focus:border-blue-600 disabled:bg-slate-100"
                />
              </div>
            </div>

            {canManageSettings && (
              <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between text-xs">
                <div className="text-slate-500 text-[11px]">
                  Values are automatically saved on change and applied across all discovery workers.
                </div>
                <Button
                  variant={isMockAdapter ? 'primary' : 'outline'}
                  size="xs"
                  onClick={() => {
                    updateSettingMutation.mutate({
                      key: 'ecourts_use_mock',
                      value: !isMockAdapter,
                      description: 'Force mock simulation adapter instead of live upstream HTTP calls',
                    });
                  }}
                >
                  Switch to {isMockAdapter ? 'Live Real API Mode' : 'Mock Mode'}
                </Button>
              </div>
            )}
          </Card>

          {/* Clean Data / Reset Card */}
          {canManageSettings && (
            <Card className="p-5 border-rose-200 bg-rose-50/20 shadow-xs">
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 rounded-xl bg-rose-100 text-rose-600 flex items-center justify-center shrink-0">
                    <Trash2 className="w-5 h-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-slate-900 text-sm">Purge Operational Dummy Data</h3>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Clear all dummy test cases, discovery jobs, backfill campaigns, and request logs to start fresh with live real-time data
                    </p>
                  </div>
                </div>

                <Button
                  variant="danger"
                  size="sm"
                  onClick={() => setPurgeModalOpen(true)}
                  leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                >
                  Purge Dummy Data
                </Button>
              </div>
            </Card>
          )}

          {/* System Parameters Card */}
          <Card>
            <CardHeader
              title="System Parameters & Rate Limits"
              subtitle="Live configuration loaded from PostgreSQL system_settings table"
              action={
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => refetchSettings()}
                  leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
                >
                  Refresh
                </Button>
              }
            />

            <div className="divide-y divide-slate-100">
              {settingsLoading ? (
                <div className="p-8 text-center text-xs text-slate-400">Loading settings...</div>
              ) : (
                settingsData?.map((setting) => (
                  <div
                    key={setting.key}
                    className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
                  >
                    <div className="flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-xs font-bold text-slate-900">{setting.key}</span>
                        {setting.is_public && <Badge variant="default" size="sm">Public</Badge>}
                      </div>
                      <p className="text-xs text-slate-500 mt-0.5">{setting.description}</p>
                    </div>

                    <div className="flex items-center gap-2 w-full sm:w-auto">
                      <div className="font-mono text-xs px-3 py-1.5 bg-slate-100 rounded-lg text-slate-800 font-semibold">
                        {typeof setting.value === 'object' ? JSON.stringify(setting.value) : String(setting.value)}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      )}

      {/* TAB 2: Audit Trail */}
      {activeTab === 'audit' && canViewAuditLogs && (
        <Card>
          <CardHeader
            title="Platform Audit Trail"
            subtitle="Immutable event log recording user logins, logouts, settings updates, and queue dispatches"
            action={
              <Button
                variant="outline"
                size="sm"
                onClick={() => refetchAudit()}
                leftIcon={<RefreshCw className="w-3.5 h-3.5" />}
              >
                Refresh Log
              </Button>
            }
          />

          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-y border-slate-200 text-slate-600 font-semibold uppercase tracking-wider text-[11px]">
                <tr>
                  <th className="py-3 px-4">Timestamp</th>
                  <th className="py-3 px-4">Action</th>
                  <th className="py-3 px-4">Operator</th>
                  <th className="py-3 px-4">Entity</th>
                  <th className="py-3 px-4">IP Address</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 font-mono">
                {auditData?.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="py-8 text-center text-slate-400 font-sans">
                      No audit events recorded yet.
                    </td>
                  </tr>
                ) : (
                  auditData?.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-4 text-slate-500 text-[11px]">
                        {new Date(log.created_at).toLocaleString()}
                      </td>
                      <td className="py-2.5 px-4 font-bold text-slate-900">
                        <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded border border-blue-100">
                          {log.action}
                        </span>
                      </td>
                      <td className="py-2.5 px-4 text-slate-700 font-sans">
                        {log.user_email || 'System Bootstrapper'}
                      </td>
                      <td className="py-2.5 px-4 text-slate-600">{log.entity}</td>
                      <td className="py-2.5 px-4 text-slate-400 text-[11px]">{log.ip_address || '127.0.0.1'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* TAB 3: Roles & Permissions Matrix */}
      {activeTab === 'roles' && (
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <Card className="p-5 border-purple-200 bg-gradient-to-b from-purple-50/20 to-transparent">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm">SUPER_ADMIN</h3>
              <Badge variant="purple" size="sm">Full Root</Badge>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Complete administrative access across all court ingestion pipelines, system parameters, audit logs, raw API responses, and user accounts.
            </p>
            <div className="text-[11px] font-mono text-slate-700 bg-white p-3 rounded-lg border border-purple-100 space-y-1 shadow-2xs">
              <div className="font-bold text-purple-900 mb-1">Allowed Capabilities:</div>
              <div>• All Navigation Sections</div>
              <div>• Start / Pause / Resume / Cancel Discovery</div>
              <div>• Manual Case Synchronization & Backfills</div>
              <div>• View Raw API Responses (JSON / Hashes)</div>
              <div>• Modify System Settings & Rate Limits</div>
              <div>• View Audit Trail & Manage Users</div>
            </div>
          </Card>

          <Card className="p-5 border-blue-200 bg-gradient-to-b from-blue-50/20 to-transparent">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm">DATA_ADMIN</h3>
              <Badge variant="navy" size="sm">Operational</Badge>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Operational control over case discovery, batch data sync, queue dispatching, and failure remediation.
            </p>
            <div className="text-[11px] font-mono text-slate-700 bg-white p-3 rounded-lg border border-blue-100 space-y-1 shadow-2xs">
              <div className="font-bold text-blue-900 mb-1">Allowed Capabilities:</div>
              <div>• Courts, Cases, Discovery, Sync, Documents, Search</div>
              <div>• API Usage & Failures Telemetry</div>
              <div>• Start Discovery & Daily Incremental Scrapes</div>
              <div>• Create & Control Backfill Campaigns</div>
              <div>• Retry Failed Queue Segments</div>
              <div className="text-rose-600 pt-1">• Restricted: Settings, Users, Raw Data</div>
            </div>
          </Card>

          <Card className="p-5 border-slate-200 bg-gradient-to-b from-slate-50/40 to-transparent">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-bold text-slate-900 text-sm">READ_ONLY</h3>
              <Badge variant="default" size="sm">Viewer</Badge>
            </div>
            <p className="text-xs text-slate-600 mb-4 leading-relaxed">
              Read-only inspection of courts, CNR case records, judgment documents, and intelligence dashboards.
            </p>
            <div className="text-[11px] font-mono text-slate-700 bg-white p-3 rounded-lg border border-slate-200 space-y-1 shadow-2xs">
              <div className="font-bold text-slate-900 mb-1">Allowed Capabilities:</div>
              <div>• Dashboard, Courts, Cases, Documents, Search</div>
              <div>• Normalized Case Dossier Viewing</div>
              <div>• Court Jurisdictional Hierarchy Inspection</div>
              <div className="text-rose-600 pt-1">• Restricted: Discovery, Sync, Failures, Settings</div>
              <div className="text-rose-600">• Operational Action Buttons Hidden</div>
            </div>
          </Card>
        </div>
      )}

      {/* Purge Dummy Data Confirmation Modal */}
      {purgeModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-fadeIn">
          <div className="bg-white rounded-2xl max-w-md w-full p-6 shadow-2xl border border-rose-100">
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
              <AlertTriangle className="w-6 h-6" />
            </div>

            <h3 className="font-extrabold text-slate-900 text-base text-center">
              Purge Operational & Dummy Data?
            </h3>

            <p className="text-xs text-slate-600 mt-2 text-center leading-relaxed">
              This action will delete all test cases, dockets, parties, hearings, orders, discovery jobs, campaigns, and request logs.
            </p>

            <div className="p-3 my-4 bg-slate-50 rounded-xl border border-slate-200 text-[11px] space-y-1 text-slate-600">
              <div className="font-semibold text-slate-800">What will be preserved:</div>
              <div>• User accounts, login credentials, and roles</div>
              <div>• Platform configuration parameters & API keys</div>
              <div>• System reference enums & statutory categories</div>
            </div>

            <div className="flex items-center gap-3">
              <Button
                variant="outline"
                size="sm"
                className="flex-1"
                onClick={() => setPurgeModalOpen(false)}
                disabled={purgeMutation.isPending}
              >
                Cancel
              </Button>
              <Button
                variant="danger"
                size="sm"
                className="flex-1"
                isLoading={purgeMutation.isPending}
                onClick={() => purgeMutation.mutate()}
                leftIcon={<Trash2 className="w-3.5 h-3.5" />}
              >
                Confirm Purge
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
