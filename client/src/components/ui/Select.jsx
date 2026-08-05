import React from 'react';
import { AlertCircle } from 'lucide-react';

const Select = React.forwardRef((
  {
    label,
    error,
    hint,
    options = [],
    placeholder = 'Select an option',
    className = '',
    id,
    ...props
  },
  ref
) => {
  const selectId = id || label?.toLowerCase().replace(/\s+/g, '-');
  const errorId = error ? `${selectId}-error` : undefined;
  const hintId = hint ? `${selectId}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const baseSelectStyles = `
    w-full px-4 py-2.5 rounded-lg
    bg-bg-input border text-text-main
    appearance-none
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-app focus:ring-primary-500 focus:border-primary-500
    disabled:bg-bg-sidebar disabled:text-text-muted disabled:cursor-not-allowed
    bg-[url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")]
    bg-[length:1.5rem_1.5rem]
    bg-[right_0.75rem_center]
    bg-no-repeat
    pr-10
  `;

  const selectStyles = error
    ? `${baseSelectStyles} border-red-500/50 focus:ring-red-500/20 focus:border-red-500`
    : `${baseSelectStyles} border-border-card focus:border-primary-500`;

  return (
    <div className={`w-full text-left ${className}`}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-semibold text-text-main mb-2">
          {label}
          {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        <select
          ref={ref}
          id={selectId}
          className={selectStyles}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          defaultValue=""
          {...props}
        >
          <option value="" disabled>
            {placeholder}
          </option>
          {options.map((option) => (
            <option key={option.value} value={option.value} className="bg-bg-card text-text-main">
              {option.label}
            </option>
          ))}
        </select>
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

Select.displayName = 'Select';

export default Select;