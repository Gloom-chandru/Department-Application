import React, { useEffect, useState } from 'react';
import { CheckCircle, AlertTriangle, XCircle, Clock, Layers, FileCheck, RefreshCw } from 'lucide-react';

export default function DryRunSummary({ summary, valid, expiresAt, onTokenExpire, importType }) {
  const [timeLeft, setTimeLeft] = useState(0);

  useEffect(() => {
    if (!expiresAt) return;

    const calculateTimeLeft = () => {
      const remaining = Math.max(0, Math.floor((expiresAt - Date.now()) / 1000));
      setTimeLeft(remaining);
      if (remaining === 0 && onTokenExpire) {
        onTokenExpire();
      }
    };

    calculateTimeLeft();
    const interval = setInterval(calculateTimeLeft, 1000);
    return () => clearInterval(interval);
  }, [expiresAt, onTokenExpire]);

  const formatTimer = (seconds) => {
    const m = Math.floor(seconds / 60);
    const s = seconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  const totalRows = summary?.totalRows || 0;
  const validRows = summary?.validRows || 0;
  const invalidRows = summary?.invalidRows || 0;

  return (
    <div className="bg-bg-sidebar/60 border border-border-card rounded-xl p-5 space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border-card pb-3">
        <div className="flex items-center space-x-2">
          {valid ? (
            <span className="flex items-center space-x-1.5 px-3 py-1 bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 rounded-full text-xs font-semibold">
              <CheckCircle className="w-3.5 h-3.5" />
              <span>Validation Passed (Ready to Confirm)</span>
            </span>
          ) : (
            <span className="flex items-center space-x-1.5 px-3 py-1 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-full text-xs font-semibold">
              <XCircle className="w-3.5 h-3.5" />
              <span>Validation Failed (Errors Found)</span>
            </span>
          )}
        </div>

        {expiresAt && (
          <div className="flex items-center space-x-1.5 text-xs text-text-muted bg-bg-card/50 px-3 py-1.5 rounded-lg border border-border-card/60">
            <Clock className="w-3.5 h-3.5 text-amber-400" />
            <span>Validation token expires in:</span>
            <span className={`font-mono font-bold ${timeLeft < 180 ? 'text-rose-400' : 'text-amber-400'}`}>
              {formatTimer(timeLeft)}
            </span>
          </div>
        )}
      </div>

      {/* Metric Cards Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div className="p-3.5 bg-bg-card/40 border border-border-card/60 rounded-xl">
          <p className="text-xs text-text-muted font-medium">Total Rows</p>
          <p className="text-2xl font-bold text-slate-100 mt-1">{totalRows}</p>
        </div>

        <div className="p-3.5 bg-emerald-500/5 border border-emerald-500/20 rounded-xl">
          <p className="text-xs text-emerald-400 font-medium">Valid Rows</p>
          <p className="text-2xl font-bold text-emerald-300 mt-1">{validRows}</p>
        </div>

        <div className="p-3.5 bg-rose-500/5 border border-rose-500/20 rounded-xl">
          <p className="text-xs text-rose-400 font-medium">Invalid Rows</p>
          <p className="text-2xl font-bold text-rose-300 mt-1">{invalidRows}</p>
        </div>

        {importType === 'MARKS' && summary?.actionCounts ? (
          <div className="p-3.5 bg-blue-500/5 border border-blue-500/20 rounded-xl">
            <p className="text-xs text-blue-400 font-medium">Actions Breakdown</p>
            <div className="text-xs text-text-main mt-1 space-y-0.5 font-mono">
              <span className="text-emerald-400">{summary.actionCounts.create || 0} CREATE</span> •{' '}
              <span className="text-blue-400">{summary.actionCounts.update || 0} UPDATE</span> •{' '}
              <span className="text-text-muted">{summary.actionCounts.noop || 0} NO-OP</span>
            </div>
          </div>
        ) : (
          <div className="p-3.5 bg-bg-card/40 border border-border-card/60 rounded-xl">
            <p className="text-xs text-text-muted font-medium">Status</p>
            <p className="text-sm font-semibold text-text-main mt-2">
              {valid ? 'All Rows Passed' : `${invalidRows} Row(s) Rejected`}
            </p>
          </div>
        )}
      </div>

      {timeLeft === 0 && (
        <div className="flex items-center space-x-2 text-xs text-rose-400 bg-rose-500/10 p-3 rounded-lg border border-rose-500/20">
          <AlertTriangle className="w-4 h-4 flex-shrink-0" />
          <span>Validation token has expired. Please run dry-run validation again before confirming.</span>
        </div>
      )}
    </div>
  );
}
