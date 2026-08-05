import React from 'react';

const Badge = React.forwardRef((
  {
    children,
    variant = 'default',
    size = 'sm',
    dot = false,
    className = '',
    ...props
  },
  ref
) => {
  const baseStyles = `
    inline-flex items-center gap-1.5 font-semibold
    rounded-full transition-all duration-200
  `;

  const variantStyles = {
    default: 'bg-bg-sidebar text-text-muted border border-border-card',
    primary: 'bg-primary-500/15 text-primary-600 dark:text-primary-400 border border-primary-500/20',
    success: 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    warning: 'bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    danger: 'bg-red-500/15 text-red-600 dark:text-red-400 border border-red-500/20',
    info: 'bg-cyan-500/15 text-cyan-600 dark:text-cyan-400 border border-cyan-500/20',
    purple: 'bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/20',
    gray: 'bg-bg-sidebar text-text-muted border border-border-app',
  };

  const sizeStyles = {
    xs: 'px-2 py-0.5 text-[10px]',
    sm: 'px-2.5 py-0.5 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-3.5 py-1.5 text-base',
  };

  const dotColors = {
    default: 'bg-text-muted',
    primary: 'bg-primary-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-cyan-500',
    purple: 'bg-purple-500',
    gray: 'bg-text-muted',
  };

  const combinedClassName = [
    baseStyles,
    variantStyles[variant] || variantStyles.default,
    sizeStyles[size] || sizeStyles.sm,
    className,
  ].filter(Boolean).join(' ');

  return (
    <span ref={ref} className={combinedClassName} {...props}>
      {dot && <span className={`${dotColors[variant] || dotColors.default} h-1.5 w-1.5 rounded-full`} aria-hidden="true" />}
      {children}
    </span>
  );
});

Badge.displayName = 'Badge';

export default Badge;