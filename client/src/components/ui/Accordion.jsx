import React, { useState } from 'react';
import { ChevronDown } from 'lucide-react';

const Accordion = ({
  items = [],
  allowMultiple = false,
  className = '',
}) => {
  const [openIds, setOpenIds] = useState([]);

  const toggleItem = (id) => {
    setOpenIds((prev) => {
      const isAlreadyOpen = prev.includes(id);
      if (allowMultiple) {
        return isAlreadyOpen ? prev.filter((item) => item !== id) : [...prev, id];
      }
      return isAlreadyOpen ? [] : [id];
    });
  };

  return (
    <div className={`space-y-2 text-left ${className}`}>
      {items.map((item) => {
        const isOpen = openIds.includes(item.id);

        return (
          <div
            key={item.id}
            className="border border-border-card/75 rounded-lg bg-bg-card/40 overflow-hidden"
          >
            <button
              type="button"
              onClick={() => toggleItem(item.id)}
              aria-expanded={isOpen}
              className="w-full flex items-center justify-between p-4 font-semibold text-sm text-text-main hover:bg-bg-sidebar/30 transition-colors text-left cursor-pointer"
            >
              <span>{item.title}</span>
              <ChevronDown
                className={`h-4 w-4 text-text-muted transition-transform duration-200 ${
                  isOpen ? 'transform rotate-180' : ''
                }`}
              />
            </button>

            {isOpen && (
              <div className="border-t border-border-card/50 p-4 text-sm text-text-muted animate-in fade-in slide-in-from-top-1 duration-150">
                {item.content}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

Accordion.displayName = 'Accordion';

export default Accordion;
