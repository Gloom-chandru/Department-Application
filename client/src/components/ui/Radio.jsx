import React from 'react';

const Radio = React.forwardRef((
  {
    label,
    className = '',
    id,
    error,
    ...props
  },
  ref
) => {
  const radioId = id || label?.toLowerCase().replace(/\s+/g, '-');

  return (
    <div className={`flex items-center gap-3 text-left ${className}`}>
      <input
        ref={ref}
        id={radioId}
        type="radio"
        className={`
          h-4 w-4 border border-border-card bg-bg-input text-primary-500
          transition-colors duration-150 cursor-pointer rounded-full
          focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-app focus:ring-primary-500
          disabled:bg-bg-sidebar disabled:cursor-not-allowed checked:bg-primary-500 checked:border-primary-500
          ${error ? 'border-red-500 focus:ring-red-500' : ''}
        `}
        {...props}
      />
      {label && (
        <label htmlFor={radioId} className="text-sm font-medium text-text-main cursor-pointer select-none">
          {label}
        </label>
      )}
    </div>
  );
});

Radio.displayName = 'Radio';

export default Radio;
