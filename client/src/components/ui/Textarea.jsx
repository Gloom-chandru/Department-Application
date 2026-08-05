import React from 'react';
import { AlertCircle } from 'lucide-react';

/**
 * Reusable Enterprise-Grade Textarea Primitive
 *
 * Props:
 * @param {string} label - Text description for input label
 * @param {string} error - Validation warning message string
 * @param {string} hint - Explanatory help indicator text
 * @param {string} className - Wrapper layout overrides
 * @param {string} id - HTMLElement reference ID
 * @param {number} rows - Starting vertical line height
 *
 * Accessibility:
 * - Links descriptions and errors dynamically using aria-describedby.
 * - Marks required status via asterisk.
 */
const Textarea = React.forwardRef((
  {
    label,
    error,
    hint,
    className = '',
    id,
    rows = 4,
    ...props
  },
  ref
) => {
  const textareaId = id || label?.toLowerCase().replace(/\s+/g, '-');
  const errorId = error ? `${textareaId}-error` : undefined;
  const hintId = hint ? `${textareaId}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const baseTextareaStyles = `
    w-full px-4 py-2.5 rounded-lg
    bg-bg-input border text-text-main placeholder-text-muted/50
    transition-all duration-200 resize-y
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-app focus:ring-primary-500 focus:border-primary-500
    disabled:bg-bg-sidebar disabled:text-text-muted disabled:cursor-not-allowed
  `;

  const textareaStyles = error
    ? `${baseTextareaStyles} border-red-500/50 focus:ring-red-500/20 focus:border-red-500`
    : `${baseTextareaStyles} border-border-card focus:border-primary-500`;

  return (
    <div className={`w-full text-left ${className}`}>
      {label && (
        <label htmlFor={textareaId} className="block text-sm font-semibold text-text-main mb-2">
          {label}
          {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <textarea
          ref={ref}
          id={textareaId}
          rows={rows}
          className={textareaStyles}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...props}
        />
      </div>
      {error && (
        <p id={errorId} className="mt-1.5 text-xs text-red-500 flex items-center gap-1.5 font-medium animate-fade-in" role="alert">
          <AlertCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
          <span>{error}</span>
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-xs text-text-muted font-medium">
          {hint}
        </p>
      )}
    </div>
  );
});

Textarea.displayName = 'Textarea';

export default Textarea;
