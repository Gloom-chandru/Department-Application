import React, { useState } from 'react';

const Tooltip = ({
  children,
  content,
  position = 'top',
  className = '',
  ...props
}) => {
  const [isVisible, setIsVisible] = useState(false);

  const show = () => setIsVisible(true);
  const hide = () => setIsVisible(false);

  const positionStyles = {
    top: 'bottom-full left-1/2 -translate-x-1/2 mb-2 origin-bottom',
    bottom: 'top-full left-1/2 -translate-x-1/2 mt-2 origin-top',
    left: 'right-full top-1/2 -translate-y-1/2 mr-2 origin-right',
    right: 'left-full top-1/2 -translate-y-1/2 ml-2 origin-left',
  };

  return (
    <div
      className={`relative inline-block ${className}`}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      {...props}
    >
      {children}
      {isVisible && content && (
        <div
          className={`
            absolute z-50 px-2 py-1.5 text-xs font-semibold text-text-inverse bg-text-main rounded shadow-premium-md
            backdrop-blur-sm transition-all duration-150 animate-fade-in pointer-events-none whitespace-nowrap
            ${positionStyles[position] || positionStyles.top}
          `}
          role="tooltip"
        >
          {content}
        </div>
      )}
    </div>
  );
};

Tooltip.displayName = 'Tooltip';

export default Tooltip;
