import React from 'react';

const Input = React.forwardRef((
  {
    label,
    error,
    hint,
    leftIcon,
    rightIcon,
    className = '',
    id,
    ...props
  },
  ref
) => {
  const inputId = id || label?.toLowerCase().replace(/\s+/g, '-');
  const errorId = error ? `${inputId}-error` : undefined;
  const hintId = hint ? `${inputId}-hint` : undefined;
  const describedBy = [errorId, hintId].filter(Boolean).join(' ') || undefined;

  const baseInputStyles = `
    w-full px-4 py-2.5 rounded-xl
    bg-slate-950 border
    text-white placeholder-slate-500
    transition-all duration-200
    focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-[#090d16]
    disabled:bg-slate-900/50 disabled:text-slate-500 disabled:cursor-not-allowed
  `;

  const inputStyles = error
    ? `${baseInputStyles} border-red-500/40 focus:border-red-500 focus:ring-red-500/20`
    : `${baseInputStyles} border-slate-800 focus:border-blue-500 focus:ring-blue-500/20`;

  const iconWrapperStyles = `
    absolute inset-y-0 flex items-center pointer-events-none text-slate-500
  `;

  return (
    <div className={`w-full ${className}`}>
      {label && (
        <label htmlFor={inputId} className="block text-sm font-semibold text-slate-200 mb-2">
          {label}
          {props.required && <span className="text-red-500 ml-1" aria-hidden="true">*</span>}
        </label>
      )}
      <div className="relative">
        {leftIcon && (
          <div className={`${iconWrapperStyles} left-0 pl-4`} aria-hidden="true">
            {leftIcon}
          </div>
        )}
        <input
          ref={ref}
          id={inputId}
          className={rightIcon ? `${inputStyles} pr-12` : leftIcon ? `${inputStyles} pl-12` : inputStyles}
          aria-invalid={!!error}
          aria-describedby={describedBy}
          {...props}
        />
        {rightIcon && (
          <div className={`${iconWrapperStyles} right-0 pr-4`} aria-hidden="true">
            {rightIcon}
          </div>
        )}
      </div>
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

Input.displayName = 'Input';

export default Input;