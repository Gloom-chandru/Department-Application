import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';

const Toast = ({ message, type = 'error', onClose, duration = 4000 }) => {
  useEffect(() => {
    const timer = setTimeout(() => {
      onClose?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-emerald-400 shrink-0" />,
    error: <XCircle className="h-5 w-5 text-red-400 shrink-0" />,
    warning: <AlertCircle className="h-5 w-5 text-amber-400 shrink-0" />,
    info: <Info className="h-5 w-5 text-blue-400 shrink-0" />,
  };

  const styles = {
    success: 'bg-emerald-950/90 border-emerald-500/30 text-emerald-300 shadow-emerald-900/10',
    error: 'bg-red-950/90 border-red-500/30 text-red-300 shadow-red-900/10',
    warning: 'bg-amber-950/90 border-amber-500/30 text-amber-300 shadow-amber-900/10',
    info: 'bg-blue-950/90 border-blue-500/30 text-blue-300 shadow-blue-900/10',
  };

  const toastContent = (
    <div
      className={`
        fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-xl border shadow-lg backdrop-blur-md
        transition-all duration-300 animate-in slide-in-from-bottom-4 fade-in
        ${styles[type] || styles.error}
      `}
      role="alert"
      aria-live="polite"
    >
      {icons[type] || icons.error}
      <span className="text-sm font-medium">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="p-0.5 rounded hover:bg-white/10 text-white/50 hover:text-white transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  return createPortal(toastContent, document.body);
};

Toast.displayName = 'Toast';

export default Toast;