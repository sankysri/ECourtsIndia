import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { apiClient } from '../../api/client.js';
import { Card, CardHeader } from '../../components/common/Card.jsx';
import { Badge } from '../../components/common/Badge.jsx';
import { EmptyState } from '../../components/common/EmptyState.jsx';
import { FileText, Cloud, Calendar, Scale } from 'lucide-react';

export const DocumentsPage = () => {
  const navigate = useNavigate();

  // Query cases to find orders/judgments
  const { data: casesData, isLoading } = useQuery({
    queryKey: ['documentsOrdersList'],
    queryFn: async () => {
      const res = await apiClient.get('/api/cases?limit=50');
      return res.data.cases || [];
    },
  });

  const allCases = casesData || [];
  const disposedCases = allCases.filter((c) => c.case_status === 'DISPOSED');

  return (
    <div className="space-y-6 animate-fadeIn pb-12 font-sans">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight">
            Judgments & Orders Document Repository
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Archived PDF judgments, interim orders, and proceedings metadata with S3 storage pipeline
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="navy" size="md">AWS S3 Storage Layer</Badge>
        </div>
      </div>

      {/* S3 Storage Status Banner */}
      <Card className="p-5 bg-gradient-to-r from-blue-950 via-slate-900 to-indigo-950 text-white border-0 shadow-xl">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 text-white flex items-center justify-center shadow-inner">
              <Cloud className="w-6 h-6" />
            </div>
            <div>
              <h3 className="font-bold text-sm text-white">AWS S3 Ingestion Bucket</h3>
              <p className="text-xs text-blue-200 font-mono">
                s3://ecourts-documents-storage/judgments/
              </p>
            </div>
          </div>
          <Badge variant="success" size="sm" dot>
            READY FOR INGESTION
          </Badge>
        </div>
      </Card>

      {/* Disposed Cases with Orders / Empty State */}
      {disposedCases.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No Judgment Documents Ingested Yet"
          description="Judgment PDF downloading and OCR extraction will archive documents into S3 as cases are synchronized."
        />
      ) : (
        <div className="space-y-4">
          <h2 className="text-sm font-bold text-slate-900">Cases with Final Judgments & Orders</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {disposedCases.map((c) => (
              <Card
                key={c.id || c.cnr}
                onClick={() => navigate(`/cases/${c.cnr}`)}
                className="p-5 hover:border-blue-300 hover:shadow-md transition-all cursor-pointer space-y-2"
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-blue-600">{c.cnr}</span>
                  <Badge variant="success" size="sm">DISPOSED</Badge>
                </div>
                <h3 className="text-sm font-bold text-slate-900 truncate">
                  {c.title || `Case ${c.case_number}`}
                </h3>
                <p className="text-xs text-slate-500 font-mono">
                  {c.court_name} • Filing: {c.filing_date ? new Date(c.filing_date).toLocaleDateString() : 'N/A'}
                </p>
              </Card>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
