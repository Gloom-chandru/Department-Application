import React from 'react';
import { Loader2 } from 'lucide-react';

const Button = React.forwardRef((
  {
    children,
    variant = 'primary',
    size = 'md',
    disabled = false,
    loading = false,
    fullWidth = false,
    leftIcon,
    rightIcon,
    type = 'button',
    className = '',
    onClick,
    ...props
  },
  ref
) => {
  const baseStyles = `
    inline-flex items-center justify-center gap-2 font-semibold
    rounded-xl transition-all duration-200 focus-visible:outline-none
    focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-offset-[#090d16]
    disabled:opacity-50 disabled:cursor-not-allowed
    active:scale-[0.98]
  `;

  const variantStyles = {
    primary: `
      bg-blue-600 hover:bg-blue-500 text-white
      focus-visible:ring-blue-500
      shadow-lg shadow-blue-600/20
      border border-transparent
    `,
    secondary: `
      bg-slate-800 hover:bg-slate-700 text-slate-100
      border border-slate-700
      focus-visible:ring-slate-500
    `,
    outline: `
      bg-transparent hover:bg-slate-800/50 text-slate-300
      border border-slate-700
      focus-visible:ring-slate-500
    `,
    ghost: `
      bg-transparent hover:bg-slate-800/30 text-slate-400
      border border-transparent
      focus-visible:ring-slate-500
    `,
    danger: `
      bg-red-600 hover:bg-red-500 text-white
      focus-visible:ring-red-500
      shadow-lg shadow-red-600/20
      border border-transparent
    `,
    success: `
      bg-emerald-600 hover:bg-emerald-500 text-white
      focus-visible:ring-emerald-500
      shadow-lg shadow-emerald-600/20
      border border-transparent
    `,
  };

  const sizeStyles = {
    xs: 'px-2.5 py-1.5 text-xs gap-1.5',
    sm: 'px-3 py-1.5 text-sm gap-1.5',
    md: 'px-4 py-2 text-sm gap-2',
    lg: 'px-6 py-3 text-base gap-2',
    xl: 'px-8 py-4 text-lg gap-2.5',
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
          {leftIcon && <span aria-hidden="true">{leftIcon}</span>}
          {children}
          {rightIcon && <span aria-hidden="true">{rightIcon}</span>}
        </>
      )}
    </button>
  );
});

Button.displayName = 'Button';

export default Button;