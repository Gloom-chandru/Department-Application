import React from 'react';
import { Link } from 'react-router-dom';
import { ChevronRight } from 'lucide-react';

const Breadcrumb = ({
  items = [],
  className = '',
}) => {
  if (items.length === 0) return null;

  return (
    <nav aria-label="Breadcrumb" className={`flex items-center text-xs font-semibold text-text-muted select-none ${className}`}>
      <ol className="flex items-center gap-2">
        {items.map((item, index) => {
          const isLast = index === items.length - 1;

          return (
            <li key={index} className="flex items-center gap-2">
              {index > 0 && <ChevronRight className="h-3.5 w-3.5 text-text-muted/40 shrink-0" />}
              {isLast ? (
                <span className="text-text-main font-bold truncate max-w-[120px] sm:max-w-xs" aria-current="page">
                  {item.label}
                </span>
              ) : (
                <Link
                  to={item.href || '#'}
                  className="hover:text-text-main transition-colors duration-150 flex items-center gap-1.5"
                >
                  {item.icon && <span className="h-3.5 w-3.5 shrink-0">{item.icon}</span>}
                  <span>{item.label}</span>
                </Link>
              )}
            </li>
          );
        })}
      </ol>
    </nav>
  );
};

Breadcrumb.displayName = 'Breadcrumb';

export default Breadcrumb;
