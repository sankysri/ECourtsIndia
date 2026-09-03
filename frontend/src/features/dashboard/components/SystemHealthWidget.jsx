import React from 'react';
import { useDispatch } from 'react-redux';
import { Card, CardHeader } from '../../../components/common/Card.jsx';
import { Badge } from '../../../components/common/Badge.jsx';
import { Button } from '../../../components/common/Button.jsx';
import { setHealthModalOpen } from '../../../store/slices/uiSlice.js';
import { Activity, Database, Server, Cloud, Cpu, ArrowUpRight } from 'lucide-react';

export const SystemHealthWidget = ({ healthData, isLoading }) => {
  const dispatch = useDispatch();
  const services = healthData?.services;

  return (
    <Card className="flex flex-col justify-between">
      <div>
        <CardHeader
          title="System Health & Infrastructure"
          subtitle="Real-time connectivity to PostgreSQL, Redis broker, and BullMQ queues"
          badge={
            <Badge variant={healthData?.status === 'UP' ? 'success' : 'warning'} dot>
              {healthData?.status === 'UP' ? 'ALL SYSTEMS OPERATIONAL' : 'DEGRADED'}
            </Badge>
          }
          action={
            <Button
              variant="outline"
              size="sm"
              onClick={() => dispatch(setHealthModalOpen(true))}
              rightIcon={<ArrowUpRight className="w-3.5 h-3.5" />}
            >
              Telemetry
            </Button>
          }
        />

        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 my-4">
          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-600 mb-1">
              <Database className="w-4 h-4 text-blue-600" />
              <span className="text-xs font-semibold">Database</span>
            </div>
            <div className="text-xs font-bold text-slate-900">
              {services?.database?.status === 'CONNECTED' ? 'PostgreSQL 16' : 'In-Memory (Standby)'}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-600 mb-1">
              <Server className="w-4 h-4 text-rose-600" />
              <span className="text-xs font-semibold">Redis Cache</span>
            </div>
            <div className="text-xs font-bold text-slate-900">
              {services?.redis?.status === 'CONNECTED' ? 'Broker Online' : 'Resilient Standby'}
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-600 mb-1">
              <Cpu className="w-4 h-4 text-purple-600" />
              <span className="text-xs font-semibold">BullMQ Queues</span>
            </div>
            <div className="text-xs font-bold text-slate-900 font-mono">
              {services?.queues?.totalQueues || 6} Queues Registered
            </div>
          </div>

          <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/80">
            <div className="flex items-center gap-2 text-slate-600 mb-1">
              <Cloud className="w-4 h-4 text-amber-600" />
              <span className="text-xs font-semibold">Object Storage</span>
            </div>
            <div className="text-xs font-bold text-slate-900">
              {services?.storage?.mode || 'S3 Placeholder'}
            </div>
          </div>
        </div>
      </div>

      <div className="pt-3 border-t border-slate-100 flex flex-wrap items-center justify-between text-xs text-slate-500 gap-2">
        <div className="flex items-center gap-2">
          <span>Uptime:</span>
          <span className="font-mono font-bold text-slate-800">
            {Math.floor((healthData?.uptimeSeconds || 0) / 60)} minutes
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span>Heap Memory:</span>
          <span className="font-mono text-slate-800">
            {healthData?.memoryUsage?.heapUsedMB || 0} MB / {healthData?.memoryUsage?.heapTotalMB || 0} MB
          </span>
        </div>
      </div>
    </Card>
  );
};
