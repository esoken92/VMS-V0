'use client';

import { useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Download,
  FileText,
  Play,
  Table2,
} from 'lucide-react';
import Link from 'next/link';
import {
  listReportDatasets,
  runReport,
} from '@/lib/actions/custom-reports';
import type { CustomReportResultDTO, ReportDatasetMetaDTO } from '@/lib/types';

export default function ReportBuilderPage() {
  const [datasets, setDatasets] = useState<ReportDatasetMetaDTO[]>([]);
  const [datasetId, setDatasetId] = useState('');
  const [filters, setFilters] = useState<Record<string, string>>({});
  const [result, setResult] = useState<CustomReportResultDTO | null>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const dataset = datasets.find((d) => d.id === datasetId);

  useEffect(() => {
    void listReportDatasets().then((r) => {
      if (r.success) {
        setDatasets(r.data);
        if (r.data.length > 0) setDatasetId(r.data[0].id);
      } else {
        setMessage({ type: 'error', text: r.error });
      }
    });
  }, []);

  useEffect(() => {
    const init: Record<string, string> = {};
    datasets
      .find((d) => d.id === datasetId)
      ?.filters.forEach((f) => {
        init[f.key] = f.default ?? '';
      });
    setFilters(init);
    setResult(null);
  }, [datasetId, datasets]);

  const run = async () => {
    if (busyRef.current || !dataset) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const r = await runReport({ dataset: dataset.id, filters });
      if (!r.success) {
        setMessage({ type: 'error', text: r.error });
        return;
      }
      setResult(r.data);
      setMessage(null);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  const exportCsv = () => {
    if (!result) return;
    const esc = (v: string | number | null) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const csv = [
      result.columns.map((c) => esc(c.label)).join(','),
      ...result.rows.map((r) => result.columns.map((c) => esc(r[c.key])).join(',')),
    ].join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${result.dataset}-${new Date().toISOString().slice(0, 10)}.csv`;
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const exportPdf = async () => {
    if (!dataset || busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      const res = await fetch('/api/reports/custom', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ dataset: dataset.id, filters }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => null);
        throw new Error(j?.error?.message ?? `Export failed (${res.status})`);
      }
      const blob = await res.blob();
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = `${dataset.id}-${new Date().toISOString().slice(0, 10)}.pdf`;
      a.click();
      URL.revokeObjectURL(a.href);
      setMessage({ type: 'success', text: 'PDF downloaded' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : 'Export failed' });
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <Link href="/dashboard/reports" className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 mb-1">
            <ArrowLeft className="w-3 h-3" /> Reports
          </Link>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Table2 className="w-6 h-6 text-primary" /> Report builder
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Pick a dataset, set filters, export to CSV or PDF.
          </p>
        </div>
      </div>

      {message && (
        <div
          className={`px-4 py-3 rounded-lg text-sm border ${
            message.type === 'success'
              ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
              : 'bg-red-500/10 text-red-400 border-red-500/30'
          }`}
          onClick={() => setMessage(null)}
        >
          {message.text}
        </div>
      )}

      {/* Dataset picker */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        {datasets.map((d) => (
          <button
            key={d.id}
            onClick={() => setDatasetId(d.id)}
            className={`text-left p-3 rounded-xl border transition-colors ${
              datasetId === d.id
                ? 'border-primary bg-primary/10'
                : 'border-border bg-card hover:bg-muted/50'
            }`}
          >
            <p className="text-sm font-medium text-foreground">{d.label}</p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{d.description}</p>
          </button>
        ))}
      </div>

      {/* Filters + run */}
      {dataset && (
        <div className="bg-card border border-border rounded-xl p-4 flex items-end gap-3 flex-wrap">
          {dataset.filters.map((f) => (
            <div key={f.key}>
              <label className="text-xs text-muted-foreground">{f.label}</label>
              {f.type === 'select' ? (
                <select
                  value={filters[f.key] ?? ''}
                  onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}
                  className="mt-1 block px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm"
                >
                  {f.options?.map((o) => (
                    <option key={o.value} value={o.value}>{o.label}</option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={filters[f.key] ?? ''}
                  placeholder={f.placeholder}
                  onChange={(e) => setFilters({ ...filters, [f.key]: e.target.value })}
                  className="mt-1 block w-28 px-3 py-2 rounded-lg bg-background border border-border text-foreground text-sm"
                />
              )}
            </div>
          ))}
          <button
            onClick={() => void run()}
            disabled={busy}
            className="px-4 py-2 rounded-lg bg-primary text-primary-foreground text-sm font-medium flex items-center gap-2 disabled:opacity-40"
          >
            <Play className="w-4 h-4" /> Run
          </button>
          {result && (
            <div className="ml-auto flex gap-2">
              <button
                onClick={exportCsv}
                className="px-4 py-2 rounded-lg border border-border text-foreground text-sm flex items-center gap-2 hover:bg-muted"
              >
                <Download className="w-4 h-4" /> CSV
              </button>
              <button
                onClick={() => void exportPdf()}
                disabled={busy}
                className="px-4 py-2 rounded-lg border border-border text-foreground text-sm flex items-center gap-2 hover:bg-muted disabled:opacity-40"
              >
                <FileText className="w-4 h-4" /> PDF
              </button>
            </div>
          )}
        </div>
      )}

      {/* Result table */}
      {result && (
        <div className="bg-card border border-border rounded-xl overflow-hidden">
          <div className="px-4 py-3 border-b border-border flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {result.row_count} row{result.row_count === 1 ? '' : 's'}
              {result.capped && ' (row cap reached — narrow the filters)'}
            </p>
            <p className="text-xs text-muted-foreground">{new Date(result.generated_at).toLocaleString()}</p>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-muted-foreground text-xs uppercase tracking-wide">
                <tr>
                  {result.columns.map((c) => (
                    <th key={c.key} className="text-left px-4 py-3">{c.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {result.rows.map((r, i) => (
                  <tr key={i} className="hover:bg-muted/30">
                    {result.columns.map((c) => (
                      <td key={c.key} className="px-4 py-2.5 text-foreground whitespace-nowrap">
                        {r[c.key] ?? '—'}
                      </td>
                    ))}
                  </tr>
                ))}
                {result.rows.length === 0 && (
                  <tr>
                    <td colSpan={result.columns.length} className="px-4 py-10 text-center text-muted-foreground">
                      No rows match these filters.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
