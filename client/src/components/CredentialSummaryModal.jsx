import React, { useEffect, useState } from 'react';
import { KeyRound, Copy, Download, X, Check, ShieldAlert } from 'lucide-react';
import { downloadCredentialsCsv } from '../utils/downloadHelper';

export default function CredentialSummaryModal({ credentials, onClose, onToast }) {
  const [copiedIndex, setCopiedIndex] = useState(null);
  const [copiedAll, setCopiedAll] = useState(false);

  // Wipes credentials from transient state on unmount
  useEffect(() => {
    return () => {
      setCopiedIndex(null);
      setCopiedAll(false);
    };
  }, []);

  if (!credentials || !Array.isArray(credentials) || credentials.length === 0) {
    return null;
  }

  const handleCopySingle = (credential, index) => {
    const text = `Identifier: ${credential.identifier || credential.rollNo || credential.email}\nName: ${credential.name}\nEmail: ${credential.email}\nTemporary Password: ${credential.temporaryPassword}`;
    navigator.clipboard.writeText(text).then(() => {
      setCopiedIndex(index);
      if (onToast) onToast('Credential copied to clipboard.', 'success');
      setTimeout(() => setCopiedIndex(null), 2000);
    });
  };

  const handleCopyAll = () => {
    const text = credentials
      .map((c, i) => `${i + 1}. Roll/Email: ${c.identifier || c.rollNo || c.email} | Name: ${c.name} | Password: ${c.temporaryPassword}`)
      .join('\n');

    navigator.clipboard.writeText(text).then(() => {
      setCopiedAll(true);
      if (onToast) onToast('All credentials copied to clipboard.', 'success');
      setTimeout(() => setCopiedAll(false), 2000);
    });
  };

  const handleDownloadCsv = () => {
    downloadCredentialsCsv(credentials, 'imported_credentials.csv');
    if (onToast) onToast('Credentials CSV downloaded successfully.', 'success');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-fadeIn">
      <div className="bg-slate-900 border border-slate-700 rounded-2xl max-w-3xl w-full p-6 shadow-2xl flex flex-col max-h-[90vh] space-y-4">
        
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2.5 bg-amber-500/10 text-amber-400 rounded-xl border border-amber-500/20">
              <KeyRound className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-slate-100">Generated Temporary Credentials</h2>
              <p className="text-xs text-slate-400">Successfully created {credentials.length} user account(s).</p>
            </div>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="p-2 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Security Alert Banner */}
        <div className="flex items-start space-x-3 p-4 bg-amber-500/10 border border-amber-500/30 text-amber-300 rounded-xl text-xs leading-relaxed">
          <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-bold text-amber-200 uppercase tracking-wide">One-Time Credential Notice</p>
            <p className="mt-0.5">
              Temporary passwords are displayed <strong>only once</strong> and are never saved in browser storage.
              Please copy or download these credentials now before closing this window.
            </p>
          </div>
        </div>

        {/* Credentials Grid */}
        <div className="flex-1 overflow-y-auto border border-slate-800 rounded-xl bg-slate-950/50 divide-y divide-slate-800">
          {credentials.map((cred, idx) => (
            <div key={idx} className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-slate-800/40 transition-colors">
              <div className="space-y-0.5">
                <div className="flex items-center space-x-2">
                  <span className="text-xs font-mono font-bold text-blue-400">
                    {cred.identifier || cred.rollNo || cred.email}
                  </span>
                  <span className="text-xs text-slate-200 font-medium">— {cred.name}</span>
                </div>
                <p className="text-xs text-slate-400 font-sans">{cred.email}</p>
              </div>

              <div className="flex items-center space-x-3">
                <div className="bg-slate-900 border border-slate-700 px-3 py-1.5 rounded-lg font-mono text-xs text-emerald-400 font-bold tracking-wider select-all">
                  {cred.temporaryPassword}
                </div>

                <button
                  type="button"
                  onClick={() => handleCopySingle(cred, idx)}
                  className="p-2 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-lg transition-colors border border-slate-700"
                  title="Copy single credential"
                >
                  {copiedIndex === idx ? (
                    <Check className="w-4 h-4 text-emerald-400" />
                  ) : (
                    <Copy className="w-4 h-4" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>

        {/* Modal Actions */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-slate-800">
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={handleCopyAll}
              className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              {copiedAll ? <Check className="w-4 h-4 text-emerald-400" /> : <Copy className="w-4 h-4 text-blue-400" />}
              <span>{copiedAll ? 'All Copied!' : 'Copy All Credentials'}</span>
            </button>

            <button
              type="button"
              onClick={handleDownloadCsv}
              className="flex items-center space-x-1.5 px-4 py-2 bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 rounded-xl text-xs font-semibold transition-colors"
            >
              <Download className="w-4 h-4 text-emerald-400" />
              <span>Download Credentials (.csv)</span>
            </button>
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 bg-blue-600 hover:bg-blue-500 text-white rounded-xl text-xs font-semibold shadow-sm transition-colors"
          >
            Done & Clear Memory
          </button>
        </div>
      </div>
    </div>
  );
}
