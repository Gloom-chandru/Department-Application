import React from 'react';

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
    w-full px-4 py-2.5 rounded-xl
    bg-slate-950 border
    text-white
    appearance-none
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#090d16]
    disabled:bg-slate-900/50 disabled:text-slate-500 disabled:cursor-not-allowed
    bg-[url("data:image/svg+xml,%3csvg xmlns='http://www.w3.org/2000/svg' fill='none' viewBox='0 0 20 20'%3e%3cpath stroke='%2394a3b8' stroke-linecap='round' stroke-linejoin='round' stroke-width='1.5' d='M6 8l4 4 4-4'/%3e%3c/svg%3e")]
    bg-[length:1.5rem_1.5rem]
    bg-[right_0.75rem_center]
    bg-no-repeat
    pr-10
  `;

  const selectStyles = error
    ? `${baseSelectStyles} border-red-500/40 focus:border-red-500 focus:ring-red-500/20`
    : `${baseSelectStyles} border-slate-800 focus:border-blue-500 focus:ring-blue-500/20`;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={selectId} className="block text-sm font-semibold text-slate-200 mb-2">
          {label}
          {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <select
        ref={ref}
        id={selectId}
        className={selectStyles}
        aria-invalid={!!error}
        aria-describedby={describedBy}
        {...props}
      >
        <option value="" disabled>
          {placeholder}
        </option>
        {options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {error && (
        <p id={errorId} className="mt-1.5 text-sm text-red-400 flex items-center gap-1.5" role="alert">
          <span className="h-4 w-4" aria-hidden="true">⚠</span>
          {error}
        </p>
      )}
      {hint && !error && (
        <p id={hintId} className="mt-1.5 text-sm text-slate-500">
          {hint}
        </p>
      )}
    </div>
  );
});

Select.displayName = 'Select';

export default Select;