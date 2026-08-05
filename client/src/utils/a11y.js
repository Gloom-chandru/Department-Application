/**
 * Accessibility Helpers
 * Standardized focus trapping and keyboard navigation utilities for WCAG 2.2 AA compliance.
 */

/**
 * Returns all focusable elements within a container element.
 * @param {HTMLElement} container 
 * @returns {NodeListOf<HTMLElement>}
 */
export const getFocusableElements = (container) => {
  if (!container) return [];
  return container.querySelectorAll(
    'a[href], area[href], input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), iframe, object, embed, [tabindex="0"], [contenteditable]'
  );
};

/**
 * Handles Tab focus trapping within a container.
 * @param {KeyboardEvent} e 
 * @param {HTMLElement} container 
 */
export const handleTabFocusTrap = (e, container) => {
  if (e.key !== 'Tab' || !container) return;
  
  const focusables = Array.from(getFocusableElements(container));
  if (focusables.length === 0) {
    e.preventDefault();
    return;
  }
  
  const first = focusables[0];
  const last = focusables[focusables.length - 1];
  const activeElement = document.activeElement;
  
  if (e.shiftKey) {
    // If Shift + Tab and currently on first, wrap to last
    if (activeElement === first) {
      last.focus();
      e.preventDefault();
    }
  } else {
    // If Tab and currently on last, wrap to first
    if (activeElement === last) {
      first.focus();
      e.preventDefault();
    }
  }
};
