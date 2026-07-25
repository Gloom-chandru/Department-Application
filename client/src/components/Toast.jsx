import React, { useEffect } from 'react';
import { CheckCircle, XCircle, X } from 'lucide-react';

const Toast = ({ message, type = 'error', onClose }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose();
    }, 4000);
    return () => clearTimeout(timer);
  }, [message, onClose]);

  if (!message) return null;

  return (
    <div className={`fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md transition-all duration-300 ${
      type === 'success'
        ? 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300 shadow-emerald-900/10'
        : 'bg-red-950/90 border-red-500/30 text-red-300 shadow-red-900/10'
    }`}>
      {type === 'success' ? (
        <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />
      ) : (
        <XCircle className="h-5 w-5 text-red-400 shrink-0" />
      )}
      <span className="text-sm font-medium">{message}</span>
      <button 
        type="button" 
        onClick={onClose} 
        aria-label="Dismiss Notification"
        className="p-0.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default Toast;
