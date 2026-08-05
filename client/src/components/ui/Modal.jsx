import React, { useEffect, useCallback, useRef } from 'react';
import { X } from 'lucide-react';
import { createPortal } from 'react-dom';
import { handleTabFocusTrap } from '../../utils/a11y';

/**
 * Reusable Enterprise-Grade Modal Component
 *
 * Props:
 * @param {boolean} isOpen - Determines visibility state
 * @param {function} onClose - Click callback to close the modal
 * @param {string} title - Header title text
 * @param {string} description - Subtitle descriptive screen reader description
 * @param {React.ReactNode} children - Modal body contents
 * @param {'sm'|'md'|'lg'|'xl'|'full'} size - Maximum container scaling bounds
 * @param {boolean} showClose - Render close "X" button
 * @param {boolean} closeOnOverlayClick - Clicking off-dialog closes the pane
 * @param {boolean} closeOnEscape - Pressing escape closes the pane
 * @param {React.ReactNode} footer - Custom bottom elements bar
 *
 * Accessibility:
 * - Traps Tab navigation cycle within the modal container.
 * - Restores focus to the triggering element on unmount/close.
 * - Aria tags describe role="dialog" and label linkages.
 */
const Modal = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  size = 'md',
  showClose = true,
  closeOnOverlayClick = true,
  closeOnEscape = true,
  className = '',
  footer,
}) => {
  const modalRef = useRef(null);
  const previousFocus = useRef(null);

  const handleKeyDown = useCallback((event) => {
    if (event.key === 'Escape' && closeOnEscape) {
      onClose();
    }
    if (event.key === 'Tab') {
      handleTabFocusTrap(event, modalRef.current);
    }
  }, [closeOnEscape, onClose]);

  useEffect(() => {
    if (isOpen) {
      previousFocus.current = document.activeElement;
      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';
      // Focus the modal for accessibility / focus trap
      if (modalRef.current) {
        modalRef.current.focus();
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

  const sizeStyles = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    full: 'max-w-full mx-4',
  };

  const modalContent = (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Overlay backdrop */}
      <div
        className="absolute inset-0 bg-black/55 backdrop-blur-[2px] transition-opacity duration-200 animate-fade-in"
        onClick={closeOnOverlayClick ? onClose : undefined}
        aria-hidden="true"
      />

      {/* Modal dialog box */}
      <div
        ref={modalRef}
        tabIndex={-1}
        className={`
          relative w-full ${sizeStyles[size] || sizeStyles.md}
          rounded-xl border border-border-card bg-bg-card
          shadow-premium-xl animate-slide-up focus:outline-none
          max-h-[90vh] flex flex-col z-10
          ${className}
        `}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? 'modal-title' : undefined}
        aria-describedby={description ? 'modal-description' : undefined}
      >
        {/* Header */}
        {(title || showClose) && (
          <div className="flex items-start justify-between border-b border-border-card/65 p-5">
            <div className="pr-4">
              {title && (
                <h2 id="modal-title" className="text-lg font-bold text-text-main tracking-tight">
                  {title}
                </h2>
              )}
              {description && (
                <p id="modal-description" className="text-sm text-text-muted mt-1">
                  {description}
                </p>
              )}
            </div>
            {showClose && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Close modal"
                className="flex-shrink-0 p-1.5 rounded-lg text-text-muted hover:text-text-main hover:bg-bg-sidebar focus-ring transition-colors cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            )}
          </div>
        )}

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-5 text-text-main">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="border-t border-border-card/65 p-5 flex items-center justify-end gap-3 bg-bg-sidebar/35 rounded-b-xl">
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  return createPortal(modalContent, document.body);
};

Modal.displayName = 'Modal';

export default Modal;