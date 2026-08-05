import React from 'react';

const Switch = React.forwardRef((
  {
    checked = false,
    onChange,
    disabled = false,
    label,
    id,
    className = '',
    ...props
  },
  ref
) => {
  const switchId = id || label?.toLowerCase().replace(/\s+/g, '-');

  const handleToggle = () => {
    if (!disabled && onChange) {
      onChange(!checked);
    }
  };

  const handleKeyDown = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      handleToggle();
    }
  };

  return (
    <div className={`flex items-center gap-3 text-left ${className}`}>
      <button
        ref={ref}
        id={switchId}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={handleToggle}
        onKeyDown={handleKeyDown}
        className={`
          relative inline-flex h-5 w-9 shrink-0 cursor-pointer rounded-full border border-transparent
          transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-bg-app focus:ring-primary-500
          disabled:cursor-not-allowed disabled:opacity-50
          ${checked ? 'bg-primary-500' : 'bg-border-card'}
        `}
        {...props}
      >
        <span
          className={`
            pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow-premium-sm ring-0
            transition duration-200 ease-in-out mt-[1px] ml-[1px]
            ${checked ? 'translate-x-4' : 'translate-x-0'}
          `}
        />
      </button>
      {label && (
        <label htmlFor={switchId} className="text-sm font-medium text-text-main cursor-pointer select-none">
          {label}
        </label>
      )}
    </div>
  );
});

Switch.displayName = 'Switch';

export default Switch;
