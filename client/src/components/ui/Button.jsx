import React from 'react';
import { Loader2 } from 'lucide-react';

/**
 * Reusable Enterprise-Grade Button Primitive
 *
 * Props:
 * @param {React.ReactNode} children - Button text or nested nodes
 * @param {'primary'|'secondary'|'outline'|'ghost'|'danger'|'success'} variant - Visual variants matching design tokens
 * @param {'xs'|'sm'|'md'|'lg'|'xl'} size - Dimension scaling
 * @param {boolean} disabled - Flag to disable clicks and focus
 * @param {boolean} loading - Displays loading spinner and disables interaction
 * @param {boolean} fullWidth - Scales width to 100%
 * @param {React.ReactNode} startIcon - Icon aligned to the left of label
 * @param {React.ReactNode} endIcon - Icon aligned to the right of label
 * @param {React.ReactNode} leftIcon - Alias for startIcon (backwards compatibility)
 * @param {React.ReactNode} rightIcon - Alias for endIcon (backwards compatibility)
 * @param {string} className - Override classes
 *
 * Accessibility:
 * - Employs aria-busy when loading to inform screen readers of state.
 * - Supports keyboard click trigger (Space / Enter) natively.
 * - Provides focus-ring double-outlines.
 */
const Button = React.forwardRef((
  {
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    fullWidth = false,
    startIcon,
    endIcon,
    leftIcon,
    rightIcon,
    type = 'button',
    className = '',
    onClick,
    ...props
  },
  ref
) => {
  const activeStartIcon = startIcon || leftIcon;
  const activeEndIcon = endIcon || rightIcon;

  const baseStyles = `
    inline-flex items-center justify-center gap-2 font-semibold
    rounded-lg transition-all duration-200 focus-visible:outline-none
    focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-bg-app
    disabled:opacity-50 disabled:cursor-not-allowed
    active:scale-[0.98] cursor-pointer
  `;

  const variantStyles = {
    primary: `
      bg-primary-600 hover:bg-primary-500 text-white
      focus-visible:ring-primary-600
      shadow-sm shadow-primary-600/10
      border border-transparent
    `,
    secondary: `
      bg-bg-card hover:bg-bg-sidebar text-text-main
      border border-border-card
      focus-visible:ring-primary-500
      shadow-sm
    `,
    outline: `
      bg-transparent hover:bg-bg-card text-text-main
      border border-border-app
      focus-visible:ring-primary-500
    `,
    ghost: `
      bg-transparent hover:bg-bg-card text-text-muted hover:text-text-main
      border border-transparent
      focus-visible:ring-primary-500
    `,
    danger: `
      bg-red-600 hover:bg-red-500 text-white
      focus-visible:ring-red-500
      shadow-sm shadow-red-600/10
      border border-transparent
    `,
    success: `
      bg-emerald-600 hover:bg-emerald-500 text-white
      focus-visible:ring-emerald-500
      shadow-sm shadow-emerald-600/10
      border border-transparent
    `,
  };

  const sizeStyles = {
    xs: 'px-2.5 py-1.5 text-xs gap-1.5',
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-5 py-2.5 text-base gap-2',
    xl: 'px-6 py-3 text-lg gap-2.5',
  };

  const widthStyles = fullWidth ? 'w-full' : '';

  const combinedClassName = [
    baseStyles,
    variantStyles[variant] || variantStyles.primary,
    sizeStyles[size] || sizeStyles.md,
    widthStyles,
    className,
  ].filter(Boolean).join(' ');

  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      onClick={onClick}
      className={combinedClassName}
      aria-busy={loading}
      aria-disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <>
          {activeStartIcon && <span aria-hidden="true" className="flex items-center">{activeStartIcon}</span>}
          {children}
          {activeEndIcon && <span aria-hidden="true" className="flex items-center">{activeEndIcon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;