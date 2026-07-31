import React from 'react';

const Badge = React.forwardRef((
  {
    children,
    variant = 'default',
    size = 'md',
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
    default: 'bg-slate-800 text-slate-300 border border-slate-700',
    primary: 'bg-blue-500/20 text-blue-400 border border-blue-500/30',
    success: 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30',
    warning: 'bg-amber-500/20 text-amber-400 border border-amber-500/30',
    danger: 'bg-red-500/20 text-red-400 border border-red-500/30',
    info: 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/30',
    purple: 'bg-violet-500/20 text-violet-400 border border-violet-500/30',
    gray: 'bg-slate-700 text-slate-300 border border-slate-600',
  };

  const sizeStyles = {
    xs: 'px-2 py-0.5 text-[10px]',
    sm: 'px-2.5 py-1 text-xs',
    md: 'px-3 py-1 text-sm',
    lg: 'px-4 py-1.5 text-base',
  };

  const dotColors = {
    default: 'bg-slate-400',
    primary: 'bg-blue-500',
    success: 'bg-emerald-500',
    warning: 'bg-amber-500',
    danger: 'bg-red-500',
    info: 'bg-cyan-500',
    purple: 'bg-violet-500',
    gray: 'bg-slate-500',
  };

  const combinedClassName = [
    baseStyles,
    variantStyles[variant] || variantStyles.default,
    sizeStyles[size] || sizeStyles.md,
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