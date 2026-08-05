import React from 'react';

const Tabs = ({
  tabs = [],
  activeTab,
  onChange,
  variant = 'line',
  className = '',
}) => {
  const isLine = variant === 'line';

  const containerStyles = isLine
    ? 'flex border-b border-border-card/75 gap-6'
    : 'flex bg-bg-sidebar/55 p-1 rounded-lg border border-border-card/50 gap-1';

  return (
    <div className={`w-full ${className}`}>
      <div className={containerStyles} role="tablist">
        {tabs.map((tab) => {
          const isActive = tab.id === activeTab;

          const tabStyles = isLine
            ? `
              flex items-center gap-2 border-b-2 py-3 font-semibold text-sm transition-colors cursor-pointer select-none
              ${isActive ? 'border-primary-500 text-primary-500' : 'border-transparent text-text-muted hover:text-text-main'}
            `
            : `
              flex-1 flex items-center justify-center gap-2 px-3 py-1.5 font-bold text-xs rounded-md transition-all cursor-pointer select-none
              ${isActive ? 'bg-bg-card text-text-main shadow-premium-sm border border-border-card/40' : 'text-text-muted hover:text-text-main'}
            `;

          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => onChange?.(tab.id)}
              className={tabStyles}
            >
              {tab.icon && <span className="h-4 w-4 shrink-0">{tab.icon}</span>}
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
};

Tabs.displayName = 'Tabs';

export default Tabs;
