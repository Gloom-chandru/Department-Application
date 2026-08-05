import React from 'react';
import { AlertCircle, HelpCircle, RefreshCw } from 'lucide-react';
import Button from './Button';

export const EmptyState = ({
  icon: Icon = HelpCircle,
  title = 'No records found',
  description = 'There is no data to show in this view right now.',
  actionLabel,
  onAction,
  className = '',
}) => {
  return (
    <div
      className={`
        flex flex-col items-center justify-center text-center p-8 border border-dashed border-border-card/80 rounded-xl bg-bg-card/25 select-none
        ${className}
      `}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-bg-sidebar border border-border-card/50 text-text-muted mb-4 shrink-0">
        <Icon className="h-6 w-6 text-text-muted" />
      </div>
      <h3 className="text-base font-bold text-text-main tracking-tight mb-1">{title}</h3>
      <p className="text-sm text-text-muted max-w-sm mb-6 leading-relaxed">{description}</p>
      {onAction && actionLabel && (
        <Button variant="secondary" size="sm" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  );
};

export const ErrorState = ({
  icon: Icon = AlertCircle,
  title = 'Something went wrong',
  description = 'An error occurred while loading this section. Please try again.',
  errorDetails,
  onRetry,
  className = '',
}) => {
  const [showDetails, setShowDetails] = React.useState(false);

  return (
    <div
      className={`
        flex flex-col items-center justify-center text-center p-8 border border-red-500/20 rounded-xl bg-red-500/5 select-none
        ${className}
      `}
    >
      <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-500/10 border border-red-500/20 text-red-500 mb-4 shrink-0 animate-pulse">
        <Icon className="h-6 w-6 text-red-500" />
      </div>
      <h3 className="text-base font-bold text-text-main tracking-tight mb-1">{title}</h3>
      <p className="text-sm text-text-muted max-w-sm mb-6 leading-relaxed">{description}</p>
      
      {errorDetails && (
        <div className="w-full max-w-md mb-6">
          <button
            type="button"
            onClick={() => setShowDetails(!showDetails)}
            className="text-xs font-semibold text-text-muted hover:text-text-main underline cursor-pointer mb-2"
          >
            {showDetails ? 'Hide error details' : 'Show error details'}
          </button>
          {showDetails && (
            <pre className="text-left text-xs bg-bg-sidebar/50 border border-border-card p-3 rounded-md overflow-x-auto text-red-500 font-mono select-text">
              {errorDetails}
            </pre>
          )}
        </div>
      )}

      {onRetry && (
        <Button
          variant="secondary"
          size="sm"
          onClick={onRetry}
          leftIcon={<RefreshCw className="h-3.5 w-3.5" />}
        >
          <span>Retry Action</span>
        </Button>
      )}
    </div>
  );
};

EmptyState.displayName = 'EmptyState';
ErrorState.displayName = 'ErrorState';
