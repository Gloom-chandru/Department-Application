import React, { useState } from 'react';
import { Check, X, Loader2 } from 'lucide-react';
import api from '../utils/api';

export default function OfferActionsCard({ offer, onUpdated }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const act = async (action) => {
    try {
      setBusy(true);
      setError('');
      const res = await api.post(`/placement/student/offers/${offer.id}/${action}`);
      onUpdated?.(res.data);
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${action} offer`);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="rounded-2xl border border-border-app bg-bg-card/40 p-4 space-y-3">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h4 className="text-sm font-semibold text-white">
            {offer.company?.name || 'Company'} — {offer.roleTitle || offer.drive?.title}
          </h4>
          <p className="text-xs text-text-muted mt-1">
            CTC: <span className="text-emerald-400 font-medium">{offer.ctc} LPA</span>
            {offer.location ? ` · ${offer.location}` : ''}
          </p>
          <p className="text-[11px] text-text-muted mt-1">Status: {offer.status}</p>
        </div>
      </div>
      {error && <p className="text-xs text-rose-400">{error}</p>}
      {offer.status === 'OFFERED' && (
        <div className="flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={() => act('accept')}
            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white hover:bg-emerald-500 disabled:opacity-50"
          >
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Accept
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={() => act('decline')}
            className="inline-flex items-center gap-1.5 rounded-xl border border-border-card bg-bg-app px-3 py-2 text-xs font-semibold text-text-main hover:border-rose-800 hover:text-rose-300 disabled:opacity-50"
          >
            <X className="h-3.5 w-3.5" />
            Decline
          </button>
        </div>
      )}
    </div>
  );
}
