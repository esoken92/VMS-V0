'use client';

import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronRight, Copy, Check } from 'lucide-react';

interface ActivityLogViewerProps {
  open: boolean;
  onClose: () => void;
  oldData: any;
  newData: any;
  action: string;
  tableName: string;
}

export default function ActivityLogViewer({
  open,
  onClose,
  oldData,
  newData,
  action,
  tableName,
}: ActivityLogViewerProps) {
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set(['old', 'new']));
  const [copied, setCopied] = useState(false);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) {
        next.delete(section);
      } else {
        next.add(section);
      }
      return next;
    });
  };

  const copyToClipboard = (data: any) => {
    const json = JSON.stringify(data, null, 2);
    navigator.clipboard.writeText(json);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const renderJsonViewer = (data: any, label: string, sectionKey: string) => {
    if (!data || Object.keys(data).length === 0) {
      return (
        <div className="p-4 bg-gray-50 rounded-lg text-sm text-gray-500">
          No data available
        </div>
      );
    }

    return (
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <button
            type="button"
            onClick={() => toggleSection(sectionKey)}
            className="flex items-center gap-2 text-sm font-medium text-gray-700 hover:text-gray-900"
          >
            {expandedSections.has(sectionKey) ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
            {label}
          </button>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => copyToClipboard(data)}
            className="h-8 w-8 p-0"
          >
            {copied ? <Check className="h-4 w-4 text-green-600" /> : <Copy className="h-4 w-4" />}
          </Button>
        </div>

        {expandedSections.has(sectionKey) && (
          <div className="bg-gray-900 rounded-lg p-4 overflow-x-auto">
            <pre className="text-xs text-gray-100 font-mono">
              {JSON.stringify(data, null, 2)}
            </pre>
          </div>
        )}
      </div>
    );
  };

  const renderDiff = () => {
    if (!oldData || !newData) return null;

    const allKeys = new Set([...Object.keys(oldData), ...Object.keys(newData)]);
    const changes: Array<{ key: string; old: any; new: any; changed: boolean }> = [];

    allKeys.forEach((key) => {
      const oldValue = oldData[key];
      const newValue = newData[key];
      const changed = JSON.stringify(oldValue) !== JSON.stringify(newValue);
      changes.push({ key, old: oldValue, new: newValue, changed });
    });

    return (
      <div className="space-y-2">
        <p className="text-sm font-medium text-gray-700">Field Changes</p>
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Field</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">Old Value</th>
                <th className="px-4 py-2 text-left font-medium text-gray-700">New Value</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {changes.map((change) => (
                <tr key={change.key} className={change.changed ? 'bg-yellow-50' : ''}>
                  <td className="px-4 py-2 font-medium text-gray-900">{change.key}</td>
                  <td className="px-4 py-2 text-gray-600">
                    {change.old === null || change.old === undefined ? (
                      <span className="text-gray-400 italic">null</span>
                    ) : (
                      String(change.old)
                    )}
                  </td>
                  <td className="px-4 py-2 text-gray-600">
                    {change.new === null || change.new === undefined ? (
                      <span className="text-gray-400 italic">null</span>
                    ) : (
                      String(change.new)
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Activity Log Details</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Header Info */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <p className="text-gray-600">Action</p>
                <p className="font-medium text-gray-900">{action}</p>
              </div>
              <div>
                <p className="text-gray-600">Table</p>
                <p className="font-medium text-gray-900">{tableName}</p>
              </div>
            </div>
          </div>

          {/* Diff View for UPDATE actions */}
          {action === 'UPDATE' && renderDiff()}

          {/* JSON Viewers */}
          {action !== 'UPDATE' && (
            <>
              {oldData && renderJsonViewer(oldData, 'Old Data (Before)', 'old')}
              {newData && renderJsonViewer(newData, 'New Data (After)', 'new')}
            </>
          )}

          {/* Footer */}
          <div className="flex justify-end pt-4 border-t border-gray-200">
            <Button type="button" variant="outline" onClick={onClose}>
              Close
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
