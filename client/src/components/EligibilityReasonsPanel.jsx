import React from 'react';
import { CheckCircle2, XCircle } from 'lucide-react';

export default function EligibilityReasonsPanel({ reasons = [], eligible }) {
  if (!reasons.length) return null;

  return (
    <div className="space-y-2">
      <div className={`text-xs font-semibold ${eligible ? 'text-emerald-400' : 'text-rose-400'}`}>
        {eligible ? 'Eligible to apply' : 'Not eligible'}
      </div>
      <ul className="space-y-1.5">
        {reasons.map((r) => (
          <li
            key={r.code}
            className="flex items-start gap-2 rounded-lg border border-slate-800 bg-slate-950/50 px-3 py-2 text-xs"
          >
            {r.passed ? (
              <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-400" />
            ) : (
              <XCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-rose-400" />
            )}
            <div>
              <span className="font-medium text-slate-300">{r.code}</span>
              <p className="text-slate-500">{r.message}</p>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
