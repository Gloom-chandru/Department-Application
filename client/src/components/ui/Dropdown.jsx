import React, { useState, useEffect, useRef } from 'react';

const Dropdown = ({
  trigger,
  align = 'right',
  children,
  className = '',
  ...props
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef(null);

  const toggle = () => setIsOpen((prev) => !prev);
  const close = () => setIsOpen(false);

  useEffect(() => {
    const handleOutsideClick = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        close();
      }
    };
    if (isOpen) {
      document.addEventListener('click', handleOutsideClick);
    }
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [isOpen]);

  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      close();
    }
  };

  const alignStyles = {
    left: 'left-0 origin-top-left',
    right: 'right-0 origin-top-right',
    center: 'left-1/2 -translate-x-1/2 origin-top',
  };

  return (
    <div
      ref={containerRef}
      className={`relative inline-block text-left ${className}`}
      onKeyDown={handleKeyDown}
      {...props}
    >
      <div onClick={toggle} className="cursor-pointer">
        {trigger}
      </div>

      {isOpen && (
        <div
          className={`
            absolute mt-2 w-56 rounded-lg border border-border-card bg-bg-card p-1 text-text-main shadow-premium-lg z-50
            transition-all duration-150 animate-slide-up focus:outline-none
            ${alignStyles[align] || alignStyles.right}
          `}
          role="menu"
          aria-orientation="vertical"
        >
          <div className="py-1" onClick={close}>
            {children}
          </div>
        </div>
      )}
    </div>
  );
};

export const DropdownItem = ({
  children,
  onClick,
  className = '',
  disabled = false,
  danger = false,
  icon,
  ...props
}) => {
  const baseStyles = `
    w-full flex items-center gap-2 px-3 py-2 text-sm rounded-md font-medium text-left cursor-pointer
    transition-colors duration-150 focus:outline-none focus:bg-bg-sidebar
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

  const colorStyles = danger
    ? 'text-red-500 hover:bg-red-500/10 hover:text-red-600'
    : 'text-text-main hover:bg-bg-sidebar hover:text-text-main';

  return (
    <button
      type="button"
      role="menuitem"
      disabled={disabled}
      onClick={disabled ? undefined : onClick}
      className={`
        ${baseStyles}
        ${colorStyles}
        ${className}
      `}
      {...props}
    >
      {icon && <span className="h-4 w-4 shrink-0 text-text-muted">{icon}</span>}
      <span className="flex-1">{children}</span>
    </button>
  );
};

export const DropdownDivider = () => (
  <div className="my-1 border-t border-border-card/50" />
);

Dropdown.displayName = 'Dropdown';
DropdownItem.displayName = 'DropdownItem';
DropdownDivider.displayName = 'DropdownDivider';

export default Dropdown;
