import React, { useEffect } from 'react';
import { CheckCircle, XCircle, AlertCircle, Info, X } from 'lucide-react';
import { createPortal } from 'react-dom';

const Toast = ({ message, type = 'error', onClose, duration = 4000 }) => {
  useEffect(() => {
    if (!message) return;
    const timer = setTimeout(() => {
      onClose?.();
    }, duration);
    return () => clearTimeout(timer);
  }, [message, duration, onClose]);

  if (!message) return null;

  const icons = {
    success: <CheckCircle className="h-5 w-5 text-emerald-500 shrink-0" />,
    error: <XCircle className="h-5 w-5 text-red-500 shrink-0" />,
    warning: <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />,
    info: <Info className="h-5 w-5 text-primary-500 shrink-0" />,
  };

  const styles = {
    success: 'bg-bg-card border-emerald-500/20 text-text-main shadow-emerald-500/5 dark:shadow-emerald-950/10',
    error: 'bg-bg-card border-red-500/20 text-text-main shadow-red-500/5 dark:shadow-red-950/10',
    warning: 'bg-bg-card border-amber-500/20 text-text-main shadow-amber-500/5 dark:shadow-amber-950/10',
    info: 'bg-bg-card border-primary-500/20 text-text-main shadow-primary-500/5 dark:shadow-primary-950/10',
  };

  const toastContent = (
    <div
      className={`
        fixed bottom-4 right-4 z-50 flex items-center gap-3 px-4 py-3 rounded-lg border shadow-premium-lg backdrop-blur-md
        transition-all duration-200 animate-slide-up
        ${styles[type] || styles.error}
      `}
      role="alert"
      aria-live="polite"
    >
      {icons[type] || icons.error}
      <span className="text-sm font-semibold tracking-tight">{message}</span>
      <button
        type="button"
        onClick={onClose}
        aria-label="Dismiss notification"
        className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-sidebar transition-colors cursor-pointer"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );

  return createPortal(toastContent, document.body);
};

Toast.displayName = 'Toast';

export default Toast;