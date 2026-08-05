import React from 'react';

const STAGE_COLOR = {
  APPLIED: 'border-blue-500/40 text-blue-300 bg-blue-500/10',
  SHORTLISTED: 'border-cyan-500/40 text-cyan-300 bg-cyan-500/10',
  APTITUDE: 'border-violet-500/40 text-violet-300 bg-violet-500/10',
  TECHNICAL: 'border-indigo-500/40 text-indigo-300 bg-indigo-500/10',
  HR: 'border-amber-500/40 text-amber-300 bg-amber-500/10',
  SELECTED: 'border-emerald-500/40 text-emerald-300 bg-emerald-500/10',
  REJECTED: 'border-rose-500/40 text-rose-300 bg-rose-500/10',
  WITHDRAWN: 'border-slate-500/40 text-text-muted bg-slate-500/10'
};

export function StageBadge({ stage }) {
  return (
    <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${STAGE_COLOR[stage] || STAGE_COLOR.APPLIED}`}>
      {stage}
    </span>
  );
}

export default function ApplicationStageTimeline({ history = [] }) {
  if (!history.length) {
    return <p className="text-xs text-text-muted">No stage history yet.</p>;
  }

  return (
    <ol className="relative space-y-3 border-l border-border-app pl-4">
      {history.map((h) => (
        <li key={h.id} className="relative">
          <span className="absolute -left-[21px] top-1 h-2.5 w-2.5 rounded-full bg-blue-500" />
          <div className="flex flex-wrap items-center gap-2 text-xs">
            {h.fromStage && (
              <>
                <StageBadge stage={h.fromStage} />
                <span className="text-text-muted">→</span>
              </>
            )}
            <StageBadge stage={h.toStage} />
            <span className="text-text-muted">
              {new Date(h.createdAt).toLocaleString()}
            </span>
          </div>
          {h.actorUser && (
            <p className="mt-0.5 text-[11px] text-text-muted">
              by {h.actorUser.name} ({h.actorUser.role})
            </p>
          )}
          {h.remarks && <p className="mt-1 text-xs text-text-muted">{h.remarks}</p>}
        </li>
      ))}
    </ol>
  );
}
