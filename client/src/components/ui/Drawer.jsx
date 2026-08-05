import React, { useEffect, useCallback, useRef } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { handleTabFocusTrap } from '../../utils/a11y';

/**
 * Reusable slide-out Drawer panel
 *
 * Props:
 * @param {boolean} isOpen - Active visibility state
 * @param {function} onClose - Triggers when drawer is requested to close
 * @param {string} title - Header text
 * @param {React.ReactNode} children - Contents inside drawer
 * @param {'left'|'right'|'top'|'bottom'} placement - Side from which the drawer slides out
 * @param {'sm'|'md'|'lg'|'xl'} size - Dimension boundaries mapping
 * @param {boolean} showClose - Render action button in header
 * @param {boolean} closeOnOverlayClick - Clicking outside closes panel
 *
 * Accessibility:
 * - Traps Tab navigation inside active drawer.
 * - Restores focus to the triggering element on unmount/close.
 */
const Drawer = ({
  isOpen,
  onClose,
  title,
  children,
  placement = 'right',
  size = 'md',
  showClose = true,
  closeOnOverlayClick = true,
  className = '',
}) => {
  const drawerRef = useRef(null);
  const previousFocus = useRef(null);

  const handleKeyDown = useCallback((e) => {
    if (e.key === 'Escape') {
      onClose();
    }
    if (e.key === 'Tab') {
      handleTabFocusTrap(e, drawerRef.current);
    }
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement;
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      if (drawerRef.current) {
        drawerRef.current.focus();
      }
    }
    return () => {
      document.removeEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'unset';
      if (previousFocus.current) {
        previousFocus.current.focus();
      }
    };
  }, [isOpen, handleKeyDown]);

  if (!isOpen) return null;

  const placementStyles = {
    left: 'left-0 top-0 bottom-0 h-full border-r border-border-card animate-in slide-in-from-left duration-250',
    right: 'right-0 top-0 bottom-0 h-full border-l border-border-card animate-in slide-in-from-right duration-250',
    top: 'top-0 left-0 right-0 w-full border-b border-border-card animate-in slide-in-from-top duration-250',
    bottom: 'bottom-0 left-0 right-0 w-full border-t border-border-card animate-in slide-in-from-bottom duration-250',
  };

  const sizeStyles = {
    sm: placement === 'left' || placement === 'right' ? 'w-64' : 'h-64',
    md: placement === 'left' || placement === 'right' ? 'w-80' : 'h-80',
    lg: placement === 'left' || placement === 'right' ? 'w-96' : 'h-96',
    xl: placement === 'left' || placement === 'right' ? 'w-[450px]' : 'h-[400px]',
  };

  const drawerContent = (
    <div className="fixed inset-0 z-50 flex">
      {/* Overlay backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-200 animate-fade-in"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Drawer box */}
      <div
        ref={drawerRef}
        tabIndex={-1}
        className={`
          absolute bg-bg-card text-text-main shadow-premium-xl flex flex-col focus:outline-none z-10
          ${placementStyles[placement] || placementStyles.right}
          ${sizeStyles[size] || sizeStyles.md}
          ${className}
        `}
        role="dialog"
        aria-modal="true"
      >
        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-center justify-between border-b border-border-card/65 p-4 shrink-0">
            {title ? (
              <h2 className="text-base font-bold text-text-main tracking-tight">{title}</h2>
            ) : (
              <div />
            )}
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close drawer"
                className="p-1 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-sidebar focus-ring transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Content body */}
        <div className="flex-1 overflow-y-auto p-4">
          {children}
        </div>
      </div>
    </div>
  );

  return createPortal(drawerContent, document.body);
};

Drawer.displayName = 'Drawer';

export default Drawer;
