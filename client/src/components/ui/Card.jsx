import React from 'react';

const Card = React.forwardRef((
  {
    children,
    className = '',
    variant = 'default',
    padding = 'lg',
    hover = false,
    border = true,
    ...props
  },
  ref
) => {
  const baseStyles = `
    rounded-2xl backdrop-blur-sm transition-all duration-300
  `;

  const variantStyles = {
    default: `
      bg-slate-900/40
      ${border ? 'border border-slate-800/60' : ''}
    `,
    elevated: `
      bg-slate-900/60
      shadow-xl shadow-black/30
      ${border ? 'border border-slate-800/40' : ''}
    `,
    glass: `
      bg-slate-900/20
      backdrop-blur-md
      ${border ? 'border border-slate-800/40' : ''}
    `,
    interactive: `
      bg-slate-900/40
      ${border ? 'border border-slate-800/60' : ''}
      hover:bg-slate-900/60 hover:border-slate-700/60
      cursor-pointer
    `,
  };

  const paddingStyles = {
    none: '',
    sm: 'p-3',
    md: 'p-5',
    lg: 'p-6',
    xl: 'p-8',
  };

  const hoverStyles = hover ? 'hover:shadow-lg hover:shadow-blue-500/5' : '';

  const combinedClassName = [
    baseStyles,
    variantStyles[variant] || variantStyles.default,
    paddingStyles[padding] || paddingStyles.lg,
    hoverStyles,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div
      ref={ref}
      className={combinedClassName}
      {...props}
    >
      {children}
    </div>
  );
});

Card.displayName = 'Card';

// Card sub-components
const CardHeader = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <div ref={ref} className={`mb-4 ${className}`} {...props}>
    {children}
  </div>
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <h3 ref={ref} className={`text-lg font-bold text-white ${className}`} {...props}>
    {children}
  </h3>
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <p ref={ref} className={`text-sm text-slate-400 mt-1 ${className}`} {...props}>
    {children}
  </p>
));
CardDescription.displayName = 'CardDescription';

const CardContent = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <div ref={ref} className={className} {...props}>
    {children}
  </div>
));
CardContent.displayName = 'CardContent';

const CardFooter = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <div ref={ref} className={`mt-4 pt-4 border-t border-slate-800/40 flex items-center gap-2 ${className}`} {...props}>
    {children}
  </div>
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
export default Card;