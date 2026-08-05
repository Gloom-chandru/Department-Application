import React from 'react';

const Checkbox = React.forwardRef((
  {
    label,
    className = '',
    id,
    error,
    ...props
  },
  ref
) => {
  const checkboxId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`flex items-start gap-3 text-left ${className}`}>
      <div className="flex h-5 items-center">
        <input
          ref={ref}
          id={checkboxId}
          type="checkbox"
          className={`
            h-4 w-4 rounded border border-border-card bg-bg-input text-primary-500
            transition-colors duration-150 cursor-pointer
            focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-app focus:ring-primary-500
            disabled:bg-bg-sidebar disabled:cursor-not-allowed checked:bg-primary-500 checked:border-primary-500
            ${error ? 'border-red-500 focus:ring-red-500' : ''}
          `}
          {...props}
        />
      </div>
      {label && (
        <label htmlFor={checkboxId} className="text-sm font-medium text-text-main cursor-pointer select-none">
          {label}
        </label>
      )}
    </div>
  );
});

Checkbox.displayName = 'Checkbox';

export default Checkbox;
