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
    rounded-xl transition-all duration-200
  `;

  const variantStyles = {
    default: `
      bg-bg-card text-text-main
      ${border ? 'border border-border-card' : ''}
      shadow-premium-sm
    `,
    elevated: `
      bg-bg-card text-text-main
      ${border ? 'border border-border-card' : ''}
      shadow-premium-lg
    `,
    glass: `
      bg-bg-card/75 backdrop-blur-md text-text-main
      ${border ? 'border border-border-card/50' : ''}
      shadow-premium-sm
    `,
    interactive: `
      bg-bg-card text-text-main
      ${border ? 'border border-border-card' : ''}
      shadow-premium-sm
      hover:shadow-premium-md hover:border-primary-500/30 hover:bg-bg-sidebar/60
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

  const hoverStyles = hover ? 'hover:shadow-premium-md hover:-translate-y-0.5' : '';

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
  <div ref={ref} className={`mb-4 flex flex-col gap-1.5 ${className}`} {...props}>
    {children}
  </div>
));
CardHeader.displayName = 'CardHeader';

const CardTitle = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <h3 ref={ref} className={`text-lg font-bold text-text-main tracking-tight ${className}`} {...props}>
    {children}
  </h3>
));
CardTitle.displayName = 'CardTitle';

const CardDescription = React.forwardRef(({ children, className = '', ...props }, ref) => (
  <p ref={ref} className={`text-sm text-text-muted ${className}`} {...props}>
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
  <div ref={ref} className={`mt-4 pt-4 border-t border-border-card/65 flex items-center gap-2 text-sm text-text-muted ${className}`} {...props}>
    {children}
  </div>
));
CardFooter.displayName = 'CardFooter';

export { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter };
export default Card;